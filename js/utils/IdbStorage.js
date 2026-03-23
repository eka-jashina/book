/**
 * IdbStorage
 *
 * Минимальная обёртка над IndexedDB:
 * открытие соединения, get/put/delete по ключу.
 *
 * Использует пул соединений: одно соединение переиспользуется
 * для последовательных операций. Соединение закрывается автоматически
 * после таймаута бездействия.
 *
 * Не содержит бизнес-логики — чистый инфраструктурный слой.
 */

/** Время бездействия до автозакрытия соединения (мс) */
const IDLE_TIMEOUT = 5000;

export class IdbStorage {
  /**
   * @param {string} dbName - Имя базы данных IndexedDB
   * @param {string} storeName - Имя object store
   * @param {number} [version=1] - Версия базы данных
   */
  constructor(dbName, storeName, version = 1) {
    this._dbName = dbName;
    this._storeName = storeName;
    this._version = version;

    /** @type {IDBDatabase|null} Кэшированное соединение */
    this._db = null;

    /** @type {Promise<IDBDatabase>|null} Промис текущего открытия */
    this._opening = null;

    /** @type {number|null} Таймер автозакрытия */
    this._idleTimer = null;
  }

  /**
   * Получить соединение (переиспользует существующее или открывает новое).
   * @private
   * @returns {Promise<IDBDatabase>}
   */
  _getConnection() {
    // Сбросить таймер бездействия при каждом обращении
    this._resetIdleTimer();

    // Если уже есть открытое соединение — вернуть его
    if (this._db) {
      return Promise.resolve(this._db);
    }

    // Если открытие уже идёт — дождаться его
    if (this._opening) {
      return this._opening;
    }

    // Открыть новое соединение
    this._opening = new Promise((resolve, reject) => {
      const request = indexedDB.open(this._dbName, this._version);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this._storeName)) {
          db.createObjectStore(this._storeName);
        }
      };

      request.onsuccess = () => {
        this._db = request.result;
        this._opening = null;

        // При неожиданном закрытии (versionchange, etc.) — сбросить кэш
        this._db.onclose = () => { this._db = null; };
        this._db.onversionchange = () => {
          this._db.close();
          this._db = null;
        };

        resolve(this._db);
      };

      request.onerror = () => {
        this._opening = null;
        reject(request.error);
      };
    });

    return this._opening;
  }

  /**
   * Сбросить таймер бездействия.
   * @private
   */
  _resetIdleTimer() {
    if (this._idleTimer !== null) {
      clearTimeout(this._idleTimer);
    }
    this._idleTimer = setTimeout(() => {
      this._closeConnection();
    }, IDLE_TIMEOUT);
  }

  /**
   * Закрыть кэшированное соединение.
   * @private
   */
  _closeConnection() {
    if (this._idleTimer !== null) {
      clearTimeout(this._idleTimer);
      this._idleTimer = null;
    }
    if (this._db) {
      this._db.close();
      this._db = null;
    }
  }

  /** Прочитать значение по ключу */
  async get(key) {
    const db = await this._getConnection();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readonly');
      const store = tx.objectStore(this._storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result ?? null);
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Записать значение по ключу (resolve только после фиксации транзакции) */
  async put(key, value) {
    const db = await this._getConnection();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readwrite');
      const store = tx.objectStore(this._storeName);
      store.put(value, key);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Удалить значение по ключу (resolve только после фиксации транзакции) */
  async delete(key) {
    const db = await this._getConnection();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._storeName, 'readwrite');
      const store = tx.objectStore(this._storeName);
      store.delete(key);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /** Закрыть соединение и освободить ресурсы */
  destroy() {
    this._closeConnection();
  }
}
