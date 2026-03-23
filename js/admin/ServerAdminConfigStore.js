/**
 * ServerAdminConfigStore
 *
 * Адаптер с тем же интерфейсом, что у AdminConfigStore,
 * но внутри — вызовы серверного API вместо IndexedDB/localStorage.
 *
 * 10 admin-модулей (ChaptersModule, SoundsModule, ...) продолжают работать
 * без изменений через this.store.* — методы становятся async.
 *
 * Операции с ресурсами (chapters, ambients, fonts, appearance)
 * делегируются в ServerConfigOperations.js.
 *
 * Решение ADR Фаза 3: замена одной строки при инициализации:
 *   AdminConfigStore.create() → ServerAdminConfigStore.create(apiClient)
 */

import {
  fetchChapters, fetchChapterContentByIndex, createChapter, updateChapterByIndex,
  removeChapterByIndex, moveChapterByIndex,
  fetchAmbients, createAmbient, updateAmbientByIndex, removeAmbientByIndex,
  fetchReadingFonts, createReadingFont, updateReadingFontByIndex,
  removeReadingFontByIndex,
  mapThemeToAPI, mapThemeFromAPI, mapVisibilityToAPI,
} from './ServerConfigOperations.js';
import { BaseConfigStore } from './BaseConfigStore.js';

export class ServerAdminConfigStore extends BaseConfigStore {
  /**
   * @param {import('../utils/ApiClient.js').ApiClient} apiClient
   */
  constructor(apiClient) {
    super();
    this._api = apiClient;
    this._activeBookId = null;
    this._books = [];
    /** @type {Object|null} Данные книги, ожидающей создания на сервере (отложенное создание) */
    this._pendingBook = null;
  }

  /**
   * Асинхронная фабрика — загружает данные с сервера
   * @param {import('../utils/ApiClient.js').ApiClient} apiClient
   * @returns {Promise<ServerAdminConfigStore>}
   */
  static async create(apiClient) {
    const store = new ServerAdminConfigStore(apiClient);
    await store._init();
    return store;
  }

  async _init() {
    const result = await this._api.getBooks();
    this._books = result.books || [];
    if (this._books.length > 0) {
      this._activeBookId = this._books[0].id;
    }
  }

  _save() { this._notifySave(); }

  // ─── Книги ────────────────────────────────────────────────────────────────

  getBooks() {
    return this._books.map(b => ({
      id: b.id, title: b.title, author: b.author, type: b.type || 'book', chaptersCount: b.chaptersCount || 0,
    }));
  }

  /** Тип активной книги ('book' | 'album') */
  getBookType() {
    if (this._pendingBook) return this._pendingBook.type || 'book';
    const book = this._books.find(b => b.id === this._activeBookId);
    const type = book?.type || 'book';
    return type;
  }

  getActiveBookId() { return this._activeBookId; }

  setActiveBook(bookId) {
    if (this._books.some(b => b.id === bookId)) this._activeBookId = bookId;
  }

  /**
   * Отложить создание книги: данные сохраняются локально,
   * реальный POST на сервер произойдёт при первом сохранении любой вкладки.
   * @param {Object} bookData - { cover: { title, author }, type?, chapters? }
   */
  setPendingBook(bookData) {
    this._pendingBook = bookData;
    this._activeBookId = null;
  }

  /** @returns {boolean} true, если книга ещё не создана на сервере */
  isPendingBook() { return !!this._pendingBook; }

  /** Отменить отложенное создание (пользователь ушёл без сохранения) */
  discardPendingBook() {
    if (!this._pendingBook) return;
    this._pendingBook = null;
  }

  /**
   * Создать отложенную книгу на сервере (вызывается перед первым сохранением).
   * @private
   * @returns {Promise<Object|undefined>} созданная книга или undefined
   */
  async _ensureBookCreated() {
    if (!this._pendingBook) return;
    const data = this._pendingBook;
    this._pendingBook = null;

    const created = await this._api.createBook({
      title: data.cover?.title || '',
      author: data.cover?.author || '',
      ...(data.type && { type: data.type }),
    });

    const entry = {
      id: created.id, title: created.title, author: created.author,
      type: created.type || data.type || 'book', chaptersCount: 0,
    };
    this._books.push(entry);
    this._activeBookId = created.id;
    return created;
  }

  async addBook(book) {
    try {
      const created = await this._api.createBook({
        title: book.cover?.title || book.title || '',
        author: book.cover?.author || book.author || '',
        ...(book.type && { type: book.type }),
      });

      // Создать главы, если переданы (например, при импорте книги из файла)
      if (book.chapters?.length > 0) {
        for (const ch of book.chapters) {
          await createChapter(this._api, created.id, ch);
        }
      }

      const entry = { id: created.id, title: created.title, author: created.author, type: created.type || book.type || 'book', chaptersCount: book.chapters?.length || 0 };
      this._books.push(entry);
      this._save();
      return created;
    } catch (err) { this._handleError('Не удалось создать книгу', err); throw err; }
  }

  async moveBook(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this._books.length) return;
    if (toIndex < 0 || toIndex >= this._books.length) return;
    const [moved] = this._books.splice(fromIndex, 1);
    this._books.splice(toIndex, 0, moved);
    try {
      this._savePromise = this._api.reorderBooks(this._books.map(b => b.id));
      await this._savePromise;
      this._save();
    } catch (err) {
      this._books.splice(toIndex, 1);
      this._books.splice(fromIndex, 0, moved);
      this._handleError('Не удалось переместить книгу', err); throw err;
    }
  }

  async removeBook(bookId) {
    try {
      await this._api.deleteBook(bookId);
      this._books = this._books.filter(b => b.id !== bookId);
      if (this._activeBookId === bookId) {
        this._activeBookId = this._books.length > 0 ? this._books[0].id : '';
      }
      this._save();
    } catch (err) { this._handleError('Не удалось удалить книгу', err); throw err; }
  }

  async updateBookMeta(bookId, meta) {
    try {
      await this._api.updateBook(bookId, { title: meta.title, author: meta.author });
      const book = this._books.find(b => b.id === bookId);
      if (book) {
        if (meta.title !== undefined) book.title = meta.title;
        if (meta.author !== undefined) book.author = meta.author;
      }
      this._save();
    } catch (err) { this._handleError('Не удалось обновить книгу', err); throw err; }
  }

  // ─── Обложка ──────────────────────────────────────────────────────────────

  async getCover() {
    if (this._pendingBook) {
      const c = this._pendingBook.cover || {};
      return { title: c.title || '', author: c.author || '', bg: c.bg || '', bgMobile: c.bgMobile || '' };
    }
    if (!this._activeBookId) return { title: '', author: '', bg: '', bgMobile: '' };
    const book = await this._api.getBook(this._activeBookId);
    return {
      title: book.title, author: book.author,
      bg: book.cover?.bg || '', bgMobile: book.cover?.bgMobile || '',
      bgMode: book.cover?.bgMode || 'default', bgCustomData: book.cover?.bgCustomUrl || null,
    };
  }

  async updateCover(cover) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    const data = {};
    if (cover.title !== undefined) data.title = cover.title;
    if (cover.author !== undefined) data.author = cover.author;
    if (cover.bgMode !== undefined) data.coverBgMode = cover.bgMode;
    if (cover.bgCustomData !== undefined) data.coverBgCustomUrl = cover.bgCustomData;
    try {
      await this._api.updateBook(this._activeBookId, data);
      this._save();
    } catch (err) { this._handleError('Не удалось обновить обложку', err); throw err; }
  }

  // ─── Главы (делегирование в ServerConfigOperations) ───────────────────────

  async getChapters() {
    if (!this._activeBookId) return [];
    return fetchChapters(this._api, this._activeBookId);
  }

  async addChapter(chapter) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try { await createChapter(this._api, this._activeBookId, chapter); this._save(); }
    catch (err) { this._handleError('Не удалось добавить главу', err); throw err; }
  }

  async getChapterContent(index) {
    if (!this._activeBookId) return null;
    return fetchChapterContentByIndex(this._api, this._activeBookId, index);
  }

  async updateChapter(index, chapter) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try { await updateChapterByIndex(this._api, this._activeBookId, index, chapter); this._save(); }
    catch (err) { this._handleError('Не удалось обновить главу', err); throw err; }
  }

  async removeChapter(index) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try { await removeChapterByIndex(this._api, this._activeBookId, index); this._save(); }
    catch (err) { this._handleError('Не удалось удалить главу', err); throw err; }
  }

  async moveChapter(fromIndex, toIndex) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try { await moveChapterByIndex(this._api, this._activeBookId, fromIndex, toIndex); this._save(); }
    catch (err) { this._handleError('Не удалось переместить главу', err); throw err; }
  }

  // ─── Амбиенты (делегирование) ─────────────────────────────────────────────

  async getAmbients() {
    if (!this._activeBookId) return [];
    const ambients = await fetchAmbients(this._api, this._activeBookId);
    if (ambients.length === 0) {
      // Книга создана без дефолтных амбиентов — создать их на сервере
      const defaults = [
        { id: 'none', label: 'Без звука', shortLabel: 'Нет', icon: '✕', file: null, visible: true, builtin: true },
        { id: 'rain', label: 'Дождь', shortLabel: 'Дождь', icon: '🌧️', file: 'sounds/ambient/rain.mp3', visible: true, builtin: true },
        { id: 'fireplace', label: 'Камин', shortLabel: 'Камин', icon: '🔥', file: 'sounds/ambient/fireplace.mp3', visible: true, builtin: true },
        { id: 'cafe', label: 'Кафе', shortLabel: 'Кафе', icon: '☕', file: 'sounds/ambient/cafe.mp3', visible: true, builtin: true },
      ];
      for (const a of defaults) {
        await createAmbient(this._api, this._activeBookId, a);
      }
      return fetchAmbients(this._api, this._activeBookId);
    }
    return ambients;
  }

  async addAmbient(ambient) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try { await createAmbient(this._api, this._activeBookId, ambient); this._save(); }
    catch (err) { this._handleError('Не удалось добавить эмбиент', err); throw err; }
  }

  async updateAmbient(index, data) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try { await updateAmbientByIndex(this._api, this._activeBookId, index, data); this._save(); }
    catch (err) { this._handleError('Не удалось обновить эмбиент', err); throw err; }
  }

  async removeAmbient(index) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try { await removeAmbientByIndex(this._api, this._activeBookId, index); this._save(); }
    catch (err) { this._handleError('Не удалось удалить эмбиент', err); throw err; }
  }

  // ─── Звуки ────────────────────────────────────────────────────────────────

  async getSounds() {
    if (!this._activeBookId) return { pageFlip: '', bookOpen: '', bookClose: '' };
    const sounds = await this._api.getSounds(this._activeBookId);
    return { pageFlip: sounds.pageFlip || '', bookOpen: sounds.bookOpen || '', bookClose: sounds.bookClose || '' };
  }

  async updateSounds(sounds) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    const data = {};
    if (sounds.pageFlip !== undefined) data.pageFlipUrl = sounds.pageFlip;
    if (sounds.bookOpen !== undefined) data.bookOpenUrl = sounds.bookOpen;
    if (sounds.bookClose !== undefined) data.bookCloseUrl = sounds.bookClose;
    try { await this._api.updateSounds(this._activeBookId, data); this._save(); }
    catch (err) { this._handleError('Не удалось обновить звуки', err); throw err; }
  }

  // ─── Настройки по умолчанию ───────────────────────────────────────────────

  async getDefaultSettings() {
    if (!this._activeBookId) return {};
    return this._api.getDefaultSettings(this._activeBookId);
  }

  async updateDefaultSettings(settings) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try { await this._api.updateDefaultSettings(this._activeBookId, settings); this._save(); }
    catch (err) { this._handleError('Не удалось обновить настройки по умолчанию', err); throw err; }
  }

  // ─── Декоративный шрифт ───────────────────────────────────────────────────

  async getDecorativeFont() {
    if (!this._activeBookId) return null;
    const font = await this._api.getDecorativeFont(this._activeBookId);
    if (!font) return null;
    return { name: font.name, dataUrl: font.fileUrl };
  }

  async setDecorativeFont(fontData) {
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try {
      if (fontData) {
        await this._api.setDecorativeFont(this._activeBookId, { name: fontData.name, fileUrl: fontData.dataUrl || fontData.fileUrl });
      } else {
        await this._api.deleteDecorativeFont(this._activeBookId);
      }
      this._save();
    } catch (err) { this._handleError('Не удалось обновить декоративный шрифт', err); throw err; }
  }

  // ─── Шрифты для чтения (делегирование) ────────────────────────────────────

  async getReadingFonts() { return fetchReadingFonts(this._api); }

  async addReadingFont(font) {
    try { await createReadingFont(this._api, font); this._save(); }
    catch (err) { this._handleError('Не удалось добавить шрифт', err); throw err; }
  }

  async updateReadingFont(index, data) {
    try { await updateReadingFontByIndex(this._api, index, data); this._save(); }
    catch (err) { this._handleError('Не удалось обновить шрифт', err); throw err; }
  }

  async removeReadingFont(index) {
    try { await removeReadingFontByIndex(this._api, index); this._save(); }
    catch (err) { this._handleError('Не удалось удалить шрифт', err); throw err; }
  }

  // ─── Оформление ───────────────────────────────────────────────────────────

  async getAppearance() {
    if (!this._activeBookId) return { fontMin: 14, fontMax: 22, light: {}, dark: {} };
    const [appearance, settings] = await Promise.all([
      this._api.getAppearance(this._activeBookId),
      this._api.getSettings().catch(() => null),
    ]);
    return {
      fontMin: settings?.fontMin ?? appearance?.fontMin ?? 14,
      fontMax: settings?.fontMax ?? appearance?.fontMax ?? 22,
      light: mapThemeFromAPI(appearance?.light),
      dark: mapThemeFromAPI(appearance?.dark),
    };
  }

  async updateAppearanceGlobal(data) {
    await this._ensureBookCreated();
    const updateData = {};
    if (data.fontMin !== undefined) updateData.fontMin = data.fontMin;
    if (data.fontMax !== undefined) updateData.fontMax = data.fontMax;
    try {
      if (Object.keys(updateData).length > 0) await this._api.updateSettings(updateData);
      if (this._activeBookId) await this._api.updateAppearance(this._activeBookId, updateData);
      this._save();
    } catch (err) { this._handleError('Не удалось обновить оформление', err); throw err; }
  }

  async updateAppearanceTheme(theme, data) {
    if (theme !== 'light' && theme !== 'dark') return;
    await this._ensureBookCreated();
    if (!this._activeBookId) return;
    try {
      await this._api.updateAppearanceTheme(this._activeBookId, theme, mapThemeToAPI(data));
      this._save();
    } catch (err) { this._handleError('Не удалось обновить тему оформления', err); throw err; }
  }

  // ─── Видимость настроек ───────────────────────────────────────────────────

  async getSettingsVisibility() {
    const settings = await this._api.getSettings().catch(() => null);
    return settings?.settingsVisibility || {
      fontSize: true, theme: true, font: true, fullscreen: true, sound: true, ambient: true,
    };
  }

  async updateSettingsVisibility(data) {
    try { await this._api.updateSettings(mapVisibilityToAPI(data)); this._save(); }
    catch (err) { this._handleError('Не удалось обновить видимость настроек', err); throw err; }
  }

  // ─── Экспорт/Импорт ──────────────────────────────────────────────────────

  async exportJSON() {
    const data = await this._api.exportConfig();
    return JSON.stringify(data, null, 2);
  }

  async importJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      await this._api.importConfig(parsed);
      const refreshed = await this._api.getBooks();
      this._books = refreshed.books || [];
      if (this._books.length > 0) this._activeBookId = this._books[0].id;
      this._save();
    } catch (err) { this._handleError('Не удалось импортировать конфигурацию', err); throw err; }
  }

  async reset() {
    try {
      for (const book of this._books) await this._api.deleteBook(book.id);
      this._books = [];
      this._activeBookId = '';
      this._save();
    } catch (err) { this._handleError('Не удалось сбросить данные', err); throw err; }
  }

  async getConfig() { return this._api.exportConfig(); }
  async clear() { await this.reset(); }

  /**
   * Загрузить изображение в S3 и вернуть URL.
   * @param {File} file
   * @returns {Promise<string>} URL загруженного файла
   */
  async uploadImage(file) {
    const result = await this._api.uploadImage(file);
    return result.fileUrl;
  }

  /**
   * Загрузить звуковой файл в S3 и вернуть URL.
   * @param {File} file
   * @returns {Promise<string>} URL загруженного файла
   */
  async uploadSound(file) {
    const result = await this._api.uploadSound(file);
    return result.fileUrl;
  }

  /**
   * Загрузить файл шрифта в S3 и вернуть URL.
   * @param {File} file
   * @returns {Promise<string>} URL загруженного файла
   */
  async uploadFont(file) {
    const result = await this._api.uploadFont(file);
    return result.fileUrl;
  }
}
