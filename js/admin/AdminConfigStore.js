/**
 * AdminConfigStore
 *
 * Хранилище конфигурации книги для админки.
 * Читает/записывает в IndexedDB (с миграцией из localStorage),
 * предоставляет CRUD для книг, глав и настроек.
 *
 * Поддерживает несколько книг. Одна книга — активная (отображается в ридере).
 *
 * Per-book: defaultSettings, appearance (light/dark), sounds, ambients, decorativeFont
 * Global:  readingFonts, settingsVisibility, fontMin, fontMax
 */

import { IdbStorage } from '../utils/IdbStorage.js';
import { StorageManager } from '../utils/StorageManager.js';
import {
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_BOOK,
  DEFAULT_CONFIG,
} from './AdminConfigDefaults.js';
import { mergeWithDefaults, validateSchema } from './AdminConfigMigration.js';
import { stripBookDataUrls } from './AdminConfigStrip.js';
import { BaseConfigStore } from './BaseConfigStore.js';

const STORAGE_KEY = 'flipbook-admin-config';
const IDB_NAME = 'flipbook-admin';
const IDB_STORE = 'config';

const lsStorage = new StorageManager(STORAGE_KEY);

// ═══════════════════════════════════════════════════════════════════════════════

export class AdminConfigStore extends BaseConfigStore {
  constructor() {
    super();
    this._config = structuredClone(DEFAULT_CONFIG);
    this._idb = new IdbStorage(IDB_NAME, IDB_STORE);

    /** @type {number} Версия конфигурации для оптимистичной блокировки (CAS) */
    this._version = 0;

    /** @type {boolean} Идёт ли сейчас операция сохранения */
    this._saving = false;

    /** @type {boolean} Были ли изменения во время сохранения (нужно повторить) */
    this._dirtyDuringSave = false;
  }

  /**
   * Асинхронная фабрика — загружает конфиг из IndexedDB (с миграцией из localStorage)
   * @returns {Promise<AdminConfigStore>}
   */
  static async create() {
    const store = new AdminConfigStore();
    await store._init();
    return store;
  }

  /**
   * Валидировать структуру конфигурации по формальной схеме.
   * Делегирует в AdminConfigMigration.validateSchema.
   * @param {Object} config
   * @returns {string[]}
   */
  static validateSchema(config) {
    return validateSchema(config);
  }

  /** Инициализация: загрузка из IndexedDB с миграцией из localStorage */
  async _init() {
    this._config = await this._load();
  }

  /** Загрузить конфиг из IndexedDB, затем localStorage (миграция), или дефолт */
  async _load() {
    // 1. Попробовать IndexedDB
    try {
      const data = await this._idb.get(STORAGE_KEY);
      if (data) {
        return mergeWithDefaults(data);
      }
    } catch (err) {
      console.debug('AdminConfigStore: IndexedDB недоступен, пробуем localStorage', err);
    }

    // 2. Миграция из localStorage
    const lsData = lsStorage.load();
    if (Object.keys(lsData).length > 0) {
      const config = mergeWithDefaults(lsData);

      // Мигрировать в IndexedDB (localStorage не удаляем — ридер читает оттуда)
      try {
        await this._idb.put(STORAGE_KEY, config);
      } catch (err) {
        console.debug('AdminConfigStore: не удалось мигрировать в IndexedDB', err);
      }

      return config;
    }

    return structuredClone(DEFAULT_CONFIG);
  }

  // ─── Персистенция ─────────────────────────────────────────────────────────

  /**
   * Сохранить конфиг в IndexedDB и localStorage.
   * Использует оптимистичную блокировку: если во время сохранения
   * произошли новые изменения, автоматически повторяет сохранение.
   */
  _save() {
    this._version++;

    if (this._saving) {
      this._dirtyDuringSave = true;
      return;
    }

    this._performSave();
    this._notifySave();
  }

  /** @private Непосредственное выполнение сохранения */
  _performSave() {
    this._saving = true;
    this._dirtyDuringSave = false;

    const snapshot = structuredClone(this._config);
    const savedVersion = this._version;

    this._saveToLocalStorage(snapshot);

    this._savePromise = this._idb.put(STORAGE_KEY, snapshot)
      .catch(err => {
        this._handleError('AdminConfigStore: IndexedDB', err);
        throw err;
      })
      .finally(() => {
        this._saving = false;
        if (this._dirtyDuringSave || this._version !== savedVersion) {
          this._performSave();
        }
      });
  }

  /**
   * Синхронное сохранение облегчённой версии в localStorage.
   * Тяжёлые data URL заменяются маркерами _idb — ридер дозагрузит из IndexedDB.
   */
  _saveToLocalStorage(snapshot) {
    const lsSnapshot = structuredClone(snapshot);

    for (const book of lsSnapshot.books) {
      stripBookDataUrls(book);
    }

    // Шрифты для чтения: data URL
    if (lsSnapshot.readingFonts) {
      for (const f of lsSnapshot.readingFonts) {
        if (f.dataUrl) {
          f._idb = true;
          delete f.dataUrl;
        }
      }
    }

    if (!lsStorage.setFull(lsSnapshot)) {
      console.warn('AdminConfigStore: localStorage сохранение не удалось');
    }
  }

  /** Получить весь конфиг */
  getConfig() {
    return structuredClone(this._config);
  }

  // ─── Книги ────────────────────────────────────────────────────────────────

  /** Получить список всех книг (краткая инфо) */
  getBooks() {
    return this._config.books.map(b => ({
      id: b.id,
      title: b.cover?.title || 'Без названия',
      author: b.cover?.author || '',
      type: b.type || 'book',
      chaptersCount: b.chapters?.length || 0,
    }));
  }

  /** ID активной книги */
  getActiveBookId() {
    return this._config.activeBookId;
  }

  /** Тип активной книги ('book' | 'album') */
  getBookType() {
    const book = this._getActiveBook();
    return book?.type || 'book';
  }

  /** Переключить активную книгу */
  setActiveBook(bookId) {
    const exists = this._config.books.some(b => b.id === bookId);
    if (!exists) return;
    this._config.activeBookId = bookId;
    this._save();
  }

  /** Получить активную книгу */
  _getActiveBook() {
    return this._config.books.find(b => b.id === this._config.activeBookId)
      || this._config.books[0];
  }

  /**
   * Выполнить операцию над активной книгой с автосохранением.
   * @param {(book: Object) => void} fn - Мутирующая операция
   * @returns {boolean} true если операция выполнена
   */
  _modifyActiveBook(fn) {
    const book = this._getActiveBook();
    if (!book) return false;
    fn(book);
    this._save();
    return true;
  }

  /** Добавить новую книгу */
  addBook(book) {
    this._config.books.push({
      id: book.id || `book_${Date.now()}`,
      type: book.type || 'book',
      cover: book.cover || { title: '', author: '', bg: '', bgMobile: '' },
      chapters: book.chapters || [],
      ...structuredClone(DEFAULT_BOOK_SETTINGS),
    });
    this._save();
  }

  /** Переместить книгу */
  moveBook(fromIndex, toIndex) {
    const books = this._config.books;
    if (fromIndex < 0 || fromIndex >= books.length) return;
    if (toIndex < 0 || toIndex >= books.length) return;

    const [moved] = books.splice(fromIndex, 1);
    books.splice(toIndex, 0, moved);
    this._save();
  }

  /** Удалить книгу по id */
  removeBook(bookId) {
    const idx = this._config.books.findIndex(b => b.id === bookId);
    if (idx === -1) return;
    this._config.books.splice(idx, 1);

    if (this._config.activeBookId === bookId) {
      this._config.activeBookId = this._config.books.length > 0 ? this._config.books[0].id : '';
    }
    this._save();
  }

  /** Переименовать книгу */
  updateBookMeta(bookId, meta) {
    const book = this._config.books.find(b => b.id === bookId);
    if (!book) return;
    if (meta.title !== undefined) book.cover.title = meta.title;
    if (meta.author !== undefined) book.cover.author = meta.author;
    this._save();
  }

  // ─── Обложка (активной книги) ─────────────────────────────────────────────

  getCover() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.cover) : structuredClone(DEFAULT_BOOK.cover);
  }

  updateCover(cover) {
    this._modifyActiveBook(book => {
      book.cover = { ...book.cover, ...cover };
    });
  }

  // ─── Главы (активной книги) ───────────────────────────────────────────────

  getChapters() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.chapters) : [];
  }

  getChapterContent(index) {
    const book = this._getActiveBook();
    if (!book || index < 0 || index >= book.chapters.length) return null;
    return book.chapters[index].htmlContent || null;
  }

  addChapter(chapter) {
    this._modifyActiveBook(book => {
      book.chapters.push({ ...chapter });
    });
  }

  updateChapter(index, chapter) {
    this._modifyActiveBook(book => {
      if (index >= 0 && index < book.chapters.length) {
        book.chapters[index] = { ...chapter };
      }
    });
  }

  removeChapter(index) {
    this._modifyActiveBook(book => {
      if (index >= 0 && index < book.chapters.length) {
        book.chapters.splice(index, 1);
      }
    });
  }

  moveChapter(fromIndex, toIndex) {
    this._modifyActiveBook(book => {
      const chapters = book.chapters;
      if (fromIndex < 0 || fromIndex >= chapters.length) return;
      if (toIndex < 0 || toIndex >= chapters.length) return;

      const [moved] = chapters.splice(fromIndex, 1);
      chapters.splice(toIndex, 0, moved);
    });
  }

  // ─── Амбиенты (per-book, активной книги) ──────────────────────────────────

  getAmbients() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.ambients) : structuredClone(DEFAULT_BOOK_SETTINGS.ambients);
  }

  addAmbient(ambient) {
    this._modifyActiveBook(book => {
      book.ambients.push({ ...ambient });
    });
  }

  updateAmbient(index, data) {
    this._modifyActiveBook(book => {
      if (index >= 0 && index < book.ambients.length) {
        book.ambients[index] = { ...book.ambients[index], ...data };
      }
    });
  }

  removeAmbient(index) {
    this._modifyActiveBook(book => {
      if (index >= 0 && index < book.ambients.length) {
        book.ambients.splice(index, 1);
      }
    });
  }

  // ─── Звуки (per-book, активной книги) ─────────────────────────────────────

  getSounds() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.sounds) : structuredClone(DEFAULT_BOOK_SETTINGS.sounds);
  }

  updateSounds(sounds) {
    this._modifyActiveBook(book => {
      book.sounds = { ...book.sounds, ...sounds };
    });
  }

  // ─── Настройки по умолчанию (per-book, активной книги) ────────────────────

  getDefaultSettings() {
    const book = this._getActiveBook();
    return book ? structuredClone(book.defaultSettings) : structuredClone(DEFAULT_BOOK_SETTINGS.defaultSettings);
  }

  updateDefaultSettings(settings) {
    this._modifyActiveBook(book => {
      book.defaultSettings = { ...book.defaultSettings, ...settings };
    });
  }

  // ─── Декоративный шрифт (per-book, активной книги) ────────────────────────

  getDecorativeFont() {
    const book = this._getActiveBook();
    return book?.decorativeFont ? { ...book.decorativeFont } : null;
  }

  setDecorativeFont(fontData) {
    this._modifyActiveBook(book => {
      book.decorativeFont = fontData ? { ...fontData } : null;
    });
  }

  // ─── Шрифты для чтения (global) ───────────────────────────────────────────

  getReadingFonts() {
    return structuredClone(this._config.readingFonts);
  }

  addReadingFont(font) {
    this._config.readingFonts.push({ ...font });
    this._save();
  }

  updateReadingFont(index, data) {
    if (index >= 0 && index < this._config.readingFonts.length) {
      this._config.readingFonts[index] = {
        ...this._config.readingFonts[index],
        ...data,
      };
      this._save();
    }
  }

  removeReadingFont(index) {
    if (index >= 0 && index < this._config.readingFonts.length) {
      this._config.readingFonts.splice(index, 1);
      this._save();
    }
  }

  // ─── Оформление ───────────────────────────────────────────────────────────

  /** Получить оформление: global fontMin/fontMax + per-book light/dark */
  getAppearance() {
    const book = this._getActiveBook();
    const appearance = book?.appearance || structuredClone(DEFAULT_BOOK_SETTINGS.appearance);
    return structuredClone({
      fontMin: this._config.fontMin,
      fontMax: this._config.fontMax,
      light: appearance.light,
      dark: appearance.dark,
    });
  }

  /** Обновить глобальные поля оформления (fontMin, fontMax) */
  updateAppearanceGlobal(data) {
    if (data.fontMin !== undefined) this._config.fontMin = data.fontMin;
    if (data.fontMax !== undefined) this._config.fontMax = data.fontMax;
    this._save();
  }

  /** Обновить per-theme поля оформления (активной книги) */
  updateAppearanceTheme(theme, data) {
    if (theme !== 'light' && theme !== 'dark') return;
    this._modifyActiveBook(book => {
      book.appearance[theme] = { ...book.appearance[theme], ...data };
    });
  }

  // ─── Видимость настроек (global) ──────────────────────────────────────────

  getSettingsVisibility() {
    return { ...this._config.settingsVisibility };
  }

  updateSettingsVisibility(data) {
    this._config.settingsVisibility = {
      ...this._config.settingsVisibility,
      ...data,
    };
    this._save();
  }

  // ─── Экспорт/Импорт ──────────────────────────────────────────────────────

  exportJSON() {
    return JSON.stringify(this._config, null, 2);
  }

  importJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    this._config = mergeWithDefaults(parsed);
    this._save();
  }

  /** Сбросить всё к дефолтным */
  reset() {
    this._config = structuredClone(DEFAULT_CONFIG);
    this._save();
  }

  /** Удалить конфиг из IndexedDB и localStorage */
  clear() {
    this._idb.delete(STORAGE_KEY).catch(() => {}); // Ошибка удаления из IDB не критична — localStorage уже очищается следом
    lsStorage.clear();
    this._config = structuredClone(DEFAULT_CONFIG);
  }

  /**
   * Загрузить изображение.
   * В локальном store загрузка не нужна — data URL хранится напрямую.
   * @returns {Promise<null>}
   */
  async uploadImage() { return null; }

  /** @returns {Promise<null>} */
  async uploadSound() { return null; }

  /** @returns {Promise<null>} */
  async uploadFont() { return null; }
}
