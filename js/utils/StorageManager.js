/**
 * STORAGE MANAGER
 * Централизованная абстракция над localStorage с обработкой ошибок.
 *
 * Особенности:
 * - Автоматическая сериализация/десериализация JSON
 * - Безопасная работа с ошибками (QuotaExceeded, SecurityError)
 * - Патч-обновление данных (merge вместо полной перезаписи)
 * - Полная замена данных (setFull) без merge
 * - Работа с «сырыми» строковыми значениями (getRaw/setRaw)
 * - Единый ключ для группировки настроек приложения
 * - Возвращает результат save() (success/failure) для обработки вызывающим кодом
 * - Статический метод removeByPrefix() для массовой очистки ключей
 */

export class StorageManager {
  /**
   * @param {string} key - Ключ в localStorage для хранения данных
   */
  constructor(key) {
    this.key = key;

    /**
     * Коллбэк на ошибку квоты — позволяет UI показать предупреждение.
     * @type {((key: string) => void)|null}
     */
    this.onQuotaExceeded = null;
  }

  // ─── JSON-операции ───────────────────────────────────────────────────────

  /**
   * Загрузить данные из localStorage (JSON)
   * @returns {Object} Сохранённые данные или пустой объект
   */
  load() {
    try {
      const data = localStorage.getItem(this.key);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error("Storage load error:", error);
      return {};
    }
  }

  /**
   * Сохранить данные в localStorage (merge с существующими)
   * @param {Object} patch - Объект с новыми/изменёнными полями
   * @returns {boolean} true если сохранение прошло успешно
   */
  save(patch) {
    try {
      const data = this.load();
      localStorage.setItem(this.key, JSON.stringify({ ...data, ...patch }));
      return true;
    } catch (error) {
      return this._handleWriteError(error);
    }
  }

  /**
   * Полностью заменить данные в localStorage (без merge).
   * В отличие от save(), не сливает с текущими данными.
   * @param {*} value - Значение для сериализации в JSON
   * @returns {boolean} true если сохранение прошло успешно
   */
  setFull(value) {
    try {
      localStorage.setItem(this.key, JSON.stringify(value));
      return true;
    } catch (error) {
      return this._handleWriteError(error);
    }
  }

  /**
   * Полностью очистить данные по ключу
   */
  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch (error) {
      console.error("Storage clear error:", error);
    }
  }

  // ─── Строковые операции (для простых флагов) ─────────────────────────────

  /**
   * Получить «сырое» строковое значение из localStorage.
   * Без JSON-десериализации — для флагов и простых значений.
   * @returns {string|null} Значение или null
   */
  getRaw() {
    try {
      return localStorage.getItem(this.key);
    } catch (err) {
      console.debug('StorageManager: localStorage недоступен для чтения', err);
      return null;
    }
  }

  /**
   * Записать «сырое» строковое значение в localStorage.
   * Без JSON-сериализации — для флагов и простых значений.
   * @param {string} value - Строка для записи
   * @returns {boolean} true если запись прошла успешно
   */
  setRaw(value) {
    try {
      localStorage.setItem(this.key, value);
      return true;
    } catch (error) {
      return this._handleWriteError(error);
    }
  }

  // ─── Статические утилиты ────────────────────────────────────────────────

  /**
   * Удалить все ключи localStorage, начинающиеся с указанного префикса.
   * @param {string} prefix - Префикс ключей для удаления
   */
  static removeByPrefix(prefix) {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (err) {
      console.debug('StorageManager.removeByPrefix: localStorage недоступен', err);
    }
  }

  // ─── Внутренние методы ──────────────────────────────────────────────────

  /**
   * Обработка ошибки записи (QuotaExceeded и прочие).
   * @private
   * @param {Error} error
   * @returns {false}
   */
  _handleWriteError(error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn("Storage quota exceeded. Unable to save data for key:", this.key);
      if (this.onQuotaExceeded) {
        this.onQuotaExceeded(this.key);
      }
    } else {
      console.error("Storage save error:", error);
    }
    return false;
  }
}
