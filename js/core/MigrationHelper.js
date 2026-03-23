/**
 * MIGRATION HELPER
 *
 * Миграция данных из localStorage/IndexedDB на сервер при первом логине.
 *
 * Логика:
 * 1. GET /api/books → пустой массив (новый аккаунт)
 * 2. Проверить наличие flipbook-admin-config в localStorage/IndexedDB
 * 3. Диалог: «У вас есть локальные данные. Импортировать?»
 * 4. «Да» → POST /api/import → удаление localStorage и IndexedDB
 * 5. «Нет» → удаление локальных данных, чистый аккаунт
 *
 * Два источника правды не держать (ADR Фаза 3).
 */

import { adminConfigStorage } from '../config/configHelpers.js';

const ADMIN_CONFIG_KEY = 'flipbook-admin-config';
const IDB_NAME = 'flipbook-admin';
const IDB_STORE = 'config';

export class MigrationHelper {
  /**
   * @param {import('../utils/ApiClient.js').ApiClient} apiClient
   */
  constructor(apiClient) {
    this._api = apiClient;
  }

  /**
   * Проверить и выполнить миграцию при необходимости.
   * Вызывается после успешной авторизации.
   *
   * @returns {Promise<boolean>} true если была миграция или очистка
   */
  async checkAndMigrate() {
    // 1. Проверить, есть ли книги на сервере
    const result = await this._api.getBooks();
    const books = result.books || result;
    if (books.length > 0) {
      // Сервер не пуст — миграция не нужна, очищаем локальные данные
      this._clearLocalData();
      return false;
    }

    // 2. Проверить наличие локальных данных
    const localConfig = await this._loadLocalConfig();
    if (!localConfig) return false;

    // Проверить, есть ли реальные данные (не только дефолтная книга)
    const hasRealData = this._hasRealData(localConfig);
    if (!hasRealData) {
      this._clearLocalData();
      return false;
    }

    // 3. Спросить пользователя
    const shouldImport = confirm(
      'Найдены локальные данные (книги, настройки). Импортировать на сервер?'
    );

    if (shouldImport) {
      // 4. Импортировать
      try {
        const importData = this._convertToImportFormat(localConfig);
        await this._api.importConfig(importData);
        this._clearLocalData();
        return true;
      } catch (err) {
        console.error('Ошибка миграции:', err);
        // Не удаляем локальные данные при ошибке
        return false;
      }
    } else {
      // 5. Очистить локальные данные
      this._clearLocalData();
      return false;
    }
  }

  /**
   * Загрузить конфиг из localStorage или IndexedDB
   * @private
   */
  async _loadLocalConfig() {
    // Попробовать IndexedDB (полные данные)
    try {
      const config = await this._readFromIDB();
      if (config) return config;
    } catch (err) {
      console.warn('MigrationHelper: не удалось прочитать из IndexedDB', err);
    }

    // Fallback: localStorage
    const lsData = adminConfigStorage.load();
    if (Object.keys(lsData).length > 0) return lsData;

    return null;
  }

  /**
   * Прочитать конфиг из IndexedDB
   * @private
   */
  _readFromIDB() {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(IDB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        request.onsuccess = () => {
          const db = request.result;
          try {
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const getReq = store.get(ADMIN_CONFIG_KEY);
            getReq.onsuccess = () => {
              db.close();
              resolve(getReq.result ?? null);
            };
            getReq.onerror = () => {
              db.close();
              resolve(null);
            };
          } catch (err) {
            console.debug('MigrationHelper: ошибка чтения IndexedDB', err);
            db.close();
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      } catch (err) {
        console.debug('MigrationHelper: не удалось открыть IndexedDB', err);
        resolve(null);
      }
    });
  }

  /**
   * Проверить, содержит ли конфиг реальные данные (не только дефолт)
   * @private
   */
  _hasRealData(config) {
    if (!config.books || config.books.length === 0) return false;

    // Если единственная книга — дефолтная без изменений
    if (config.books.length === 1) {
      const book = config.books[0];
      if (book.id === 'default' && (!book.chapters || book.chapters.length === 0)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Конвертировать локальный формат в серверный формат импорта
   * @private
   */
  _convertToImportFormat(config) {
    const books = (config.books || []).map(book => {
      const cover = book.cover || {};
      return {
        title: cover.title || '',
        author: cover.author || '',
        cover: {
          bg: cover.bg || '',
          bgMobile: cover.bgMobile || '',
          bgMode: cover.bgMode || 'default',
          bgCustomUrl: cover.bgCustomData || null,
        },
        chapters: (book.chapters || []).map(ch => ({
          title: ch.title || '',
          filePath: ch.file || null,
          hasHtmlContent: !!ch.htmlContent,
          bg: ch.bg || '',
          bgMobile: ch.bgMobile || '',
        })),
        defaultSettings: book.defaultSettings || null,
        appearance: book.appearance ? {
          fontMin: config.fontMin ?? 14,
          fontMax: config.fontMax ?? 22,
          light: book.appearance.light ? {
            coverBgStart: book.appearance.light.coverBgStart,
            coverBgEnd: book.appearance.light.coverBgEnd,
            coverText: book.appearance.light.coverText,
            coverBgImageUrl: book.appearance.light.coverBgImage || null,
            pageTexture: book.appearance.light.pageTexture,
            customTextureUrl: book.appearance.light.customTextureData || null,
            bgPage: book.appearance.light.bgPage,
            bgApp: book.appearance.light.bgApp,
          } : null,
          dark: book.appearance.dark ? {
            coverBgStart: book.appearance.dark.coverBgStart,
            coverBgEnd: book.appearance.dark.coverBgEnd,
            coverText: book.appearance.dark.coverText,
            coverBgImageUrl: book.appearance.dark.coverBgImage || null,
            pageTexture: book.appearance.dark.pageTexture,
            customTextureUrl: book.appearance.dark.customTextureData || null,
            bgPage: book.appearance.dark.bgPage,
            bgApp: book.appearance.dark.bgApp,
          } : null,
        } : null,
        sounds: book.sounds ? {
          pageFlip: book.sounds.pageFlip,
          bookOpen: book.sounds.bookOpen,
          bookClose: book.sounds.bookClose,
        } : null,
        ambients: (book.ambients || []).map(a => ({
          ambientKey: a.id,
          label: a.label,
          shortLabel: a.shortLabel,
          icon: a.icon,
          fileUrl: a.file || null,
          visible: a.visible ?? true,
          builtin: a.builtin ?? false,
        })),
        decorativeFont: book.decorativeFont ? {
          name: book.decorativeFont.name,
          fileUrl: book.decorativeFont.dataUrl || '',
        } : null,
      };
    });

    const readingFonts = (config.readingFonts || []).map(f => ({
      fontKey: f.id,
      label: f.label,
      family: f.family,
      builtin: f.builtin ?? false,
      enabled: f.enabled ?? true,
      fileUrl: f.dataUrl || null,
    }));

    const globalSettings = {
      fontMin: config.fontMin ?? 14,
      fontMax: config.fontMax ?? 22,
      settingsVisibility: config.settingsVisibility || {},
    };

    return { books, readingFonts, globalSettings };
  }

  /**
   * Удалить все локальные данные
   * @private
   */
  _clearLocalData() {
    // localStorage: конфиг админки
    adminConfigStorage.clear();

    // Не удаляем reader-settings:* — они содержат прогресс чтения,
    // который нужен для быстрого доступа до загрузки серверных данных.
    // Серверный прогресс является источником правды, а localStorage
    // используется как кэш для мгновенного отображения (Continue button).

    // IndexedDB
    try {
      indexedDB.deleteDatabase(IDB_NAME);
    } catch (err) {
      console.debug('MigrationHelper: не удалось удалить IndexedDB', err);
    }

    // sessionStorage
    try {
      sessionStorage.removeItem('flipbook-reading-session');
      sessionStorage.removeItem('flipbook-admin-mode');
      sessionStorage.removeItem('flipbook-admin-edit-book');
    } catch (err) {
      console.debug('MigrationHelper: не удалось очистить sessionStorage', err);
    }
  }
}
