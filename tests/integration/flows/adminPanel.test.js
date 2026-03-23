/**
 * INTEGRATION TEST: Admin Panel Flow
 * Тестирование полного потока в admin: ServerAdminConfigStore как адаптер к API →
 * CRUD книг, глав, звуков, оформления, шрифтов, экспорт/импорт.
 *
 * Не тестирует UI-модули (ChaptersModule и т.д.), а проверяет data layer:
 * ServerAdminConfigStore ↔ ApiClient (мок) — полный lifecycle.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerAdminConfigStore } from '../../../js/admin/ServerAdminConfigStore.js';

describe('Admin Panel Flow Integration', () => {
  /** @type {Object} */
  let mockApi;
  /** @type {ServerAdminConfigStore} */
  let store;

  // ── Моковые данные ──

  const makeBook = (id, title = 'Test', author = '', chaptersCount = 0) =>
    ({ id, title, author, chaptersCount });

  const makeChapter = (id, title, opts = {}) => ({
    id,
    title,
    filePath: opts.filePath || '',
    hasHtmlContent: opts.hasHtmlContent ?? false,
    bg: opts.bg || '',
    bgMobile: opts.bgMobile || '',
  });

  const makeAmbient = (id, label, opts = {}) => ({
    id,
    ambientKey: opts.ambientKey || id,
    label,
    shortLabel: opts.shortLabel || label,
    icon: opts.icon || '',
    fileUrl: opts.fileUrl || null,
    visible: opts.visible ?? true,
    builtin: opts.builtin ?? false,
  });

  const makeFont = (id, label, family, opts = {}) => ({
    id,
    fontKey: opts.fontKey || id,
    label,
    family,
    builtin: opts.builtin ?? true,
    enabled: opts.enabled ?? true,
    fileUrl: opts.fileUrl || null,
  });

  const createMockApi = () => ({
    // Books
    getBooks: vi.fn().mockResolvedValue({ books: [
      makeBook('b1', 'Первая книга', 'Автор 1', 3),
      makeBook('b2', 'Вторая книга', 'Автор 2', 1),
    ]}),
    getBook: vi.fn().mockResolvedValue({
      id: 'b1', title: 'Первая книга', author: 'Автор 1',
      cover: { bg: '', bgMobile: '', bgMode: 'default' },
    }),
    createBook: vi.fn().mockImplementation(({ title, author }) => Promise.resolve({
      id: `b${Date.now()}`, title, author,
    })),
    updateBook: vi.fn().mockResolvedValue({}),
    deleteBook: vi.fn().mockResolvedValue({}),
    reorderBooks: vi.fn().mockResolvedValue({}),

    // Chapters
    getChapters: vi.fn().mockResolvedValue({ chapters: [
      makeChapter('c1', 'Глава 1', { hasHtmlContent: true }),
      makeChapter('c2', 'Глава 2'),
      makeChapter('c3', 'Глава 3'),
    ]}),
    createChapter: vi.fn().mockResolvedValue({ id: 'c-new' }),
    updateChapter: vi.fn().mockResolvedValue({}),
    deleteChapter: vi.fn().mockResolvedValue({}),
    reorderChapters: vi.fn().mockResolvedValue({}),

    // Sounds
    getSounds: vi.fn().mockResolvedValue({
      pageFlip: '/sounds/flip.mp3',
      bookOpen: '/sounds/open.mp3',
      bookClose: '/sounds/close.mp3',
    }),
    updateSounds: vi.fn().mockResolvedValue({}),

    // Ambients
    getAmbients: vi.fn().mockResolvedValue({ ambients: [
      makeAmbient('a1', 'Дождь', { ambientKey: 'rain', icon: '🌧️', builtin: true }),
      makeAmbient('a2', 'Камин', { ambientKey: 'fireplace', icon: '🔥', builtin: true }),
    ]}),
    createAmbient: vi.fn().mockResolvedValue({ id: 'a-new' }),
    updateAmbient: vi.fn().mockResolvedValue({}),
    deleteAmbient: vi.fn().mockResolvedValue({}),

    // Appearance
    getAppearance: vi.fn().mockResolvedValue({
      fontMin: 14, fontMax: 22,
      light: { coverBgStart: '#3a2d1f', coverBgEnd: '#2a2016', coverText: '#f2e9d8' },
      dark: { coverBgStart: '#111', coverBgEnd: '#000', coverText: '#eae' },
    }),
    updateAppearance: vi.fn().mockResolvedValue({}),
    updateAppearanceTheme: vi.fn().mockResolvedValue({}),

    // Fonts
    getFonts: vi.fn().mockResolvedValue({ fonts: [
      makeFont('f1', 'Georgia', 'Georgia, serif', { fontKey: 'georgia', builtin: true }),
      makeFont('f2', 'Inter', 'Inter, sans-serif', { fontKey: 'inter', builtin: true }),
    ]}),
    createFont: vi.fn().mockResolvedValue({ id: 'f-new' }),
    updateFont: vi.fn().mockResolvedValue({}),
    deleteFont: vi.fn().mockResolvedValue({}),

    // Settings
    getSettings: vi.fn().mockResolvedValue({
      fontMin: 14, fontMax: 22,
      settingsVisibility: {
        fontSize: true, theme: true, font: true,
        fullscreen: true, sound: true, ambient: true,
      },
    }),
    updateSettings: vi.fn().mockResolvedValue({}),

    // Default settings
    getDefaultSettings: vi.fn().mockResolvedValue({
      font: 'georgia', fontSize: 18, theme: 'light',
    }),
    updateDefaultSettings: vi.fn().mockResolvedValue({}),

    // Decorative font
    getDecorativeFont: vi.fn().mockResolvedValue(null),
    setDecorativeFont: vi.fn().mockResolvedValue({}),
    deleteDecorativeFont: vi.fn().mockResolvedValue({}),

    // Export / Import
    exportConfig: vi.fn().mockResolvedValue({ books: [], readingFonts: [] }),
    importConfig: vi.fn().mockResolvedValue({}),
  });

  beforeEach(async () => {
    mockApi = createMockApi();
    store = await ServerAdminConfigStore.create(mockApi);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // Инициализация и книги
  // ═══════════════════════════════════════════

  describe('Initialization and book management', () => {
    it('should load books on init and set first as active', () => {
      expect(mockApi.getBooks).toHaveBeenCalledTimes(1);
      expect(store.getActiveBookId()).toBe('b1');

      const books = store.getBooks();
      expect(books).toHaveLength(2);
      expect(books[0]).toEqual({ id: 'b1', title: 'Первая книга', author: 'Автор 1', type: 'book', chaptersCount: 3 });
    });

    it('should switch active book', () => {
      store.setActiveBook('b2');
      expect(store.getActiveBookId()).toBe('b2');
    });

    it('should not switch to non-existent book', () => {
      store.setActiveBook('non-existent');
      expect(store.getActiveBookId()).toBe('b1');
    });

    it('should add a new book via API', async () => {
      const created = await store.addBook({ cover: { title: 'Новая книга', author: 'Новый автор' } });

      expect(mockApi.createBook).toHaveBeenCalledWith({
        title: 'Новая книга',
        author: 'Новый автор',
      });
      expect(store.getBooks()).toHaveLength(3);
      expect(created.title).toBe('Новая книга');
    });

    it('should remove book and switch active if needed', async () => {
      await store.removeBook('b1');

      expect(mockApi.deleteBook).toHaveBeenCalledWith('b1');
      expect(store.getBooks()).toHaveLength(1);
      expect(store.getActiveBookId()).toBe('b2');
    });

    it('should update book metadata', async () => {
      await store.updateBookMeta('b1', { title: 'Updated Title', author: 'New Author' });

      expect(mockApi.updateBook).toHaveBeenCalledWith('b1', {
        title: 'Updated Title',
        author: 'New Author',
      });
      expect(store.getBooks()[0].title).toBe('Updated Title');
    });

    it('should move books and call reorderBooks API', async () => {
      await store.moveBook(0, 1);

      expect(mockApi.reorderBooks).toHaveBeenCalledWith(['b2', 'b1']);
      expect(store.getBooks()[0].id).toBe('b2');
      expect(store.getBooks()[1].id).toBe('b1');
    });

    it('should rollback order on move failure', async () => {
      mockApi.reorderBooks.mockRejectedValue(new Error('Network error'));

      await expect(store.moveBook(0, 1)).rejects.toThrow('Network error');

      // Order rolled back
      expect(store.getBooks()[0].id).toBe('b1');
      expect(store.getBooks()[1].id).toBe('b2');
    });
  });

  // ═══════════════════════════════════════════
  // Главы
  // ═══════════════════════════════════════════

  describe('Chapter management', () => {
    it('should get chapters for active book', async () => {
      const chapters = await store.getChapters();

      expect(mockApi.getChapters).toHaveBeenCalledWith('b1');
      expect(chapters).toHaveLength(3);
      expect(chapters[0]).toMatchObject({
        id: 'c1',
        title: 'Глава 1',
        _hasHtmlContent: true,
      });
    });

    it('should return empty array when no active book', async () => {
      await store.removeBook('b1');
      await store.removeBook('b2');

      const chapters = await store.getChapters();
      expect(chapters).toEqual([]);
    });

    it('should add a chapter', async () => {
      await store.addChapter({
        title: 'Новая глава',
        htmlContent: '<p>Content</p>',
        file: '',
        bg: '/bg.webp',
        bgMobile: '/bg-m.webp',
      });

      expect(mockApi.createChapter).toHaveBeenCalledWith('b1', {
        title: 'Новая глава',
        htmlContent: '<p>Content</p>',
        filePath: undefined,
        bg: '/bg.webp',
        bgMobile: '/bg-m.webp',
      });
    });

    it('should update a chapter by index', async () => {
      await store.updateChapter(1, {
        title: 'Updated Chapter 2',
        htmlContent: '<p>New</p>',
      });

      expect(mockApi.getChapters).toHaveBeenCalledWith('b1');
      expect(mockApi.updateChapter).toHaveBeenCalledWith('b1', 'c2', {
        title: 'Updated Chapter 2',
        htmlContent: '<p>New</p>',
      });
    });

    it('should remove a chapter by index', async () => {
      await store.removeChapter(2);

      expect(mockApi.deleteChapter).toHaveBeenCalledWith('b1', 'c3');
    });

    it('should move a chapter (reorder)', async () => {
      await store.moveChapter(0, 2);

      expect(mockApi.reorderChapters).toHaveBeenCalledWith('b1', ['c2', 'c3', 'c1']);
    });

    it('should handle out-of-range chapter index gracefully', async () => {
      await store.updateChapter(99, { title: 'Ghost' });

      // getChapters called, but no update since index is out of range
      expect(mockApi.updateChapter).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // Обложка
  // ═══════════════════════════════════════════

  describe('Cover management', () => {
    it('should get cover info for active book', async () => {
      const cover = await store.getCover();

      expect(mockApi.getBook).toHaveBeenCalledWith('b1');
      expect(cover.title).toBe('Первая книга');
      expect(cover.bgMode).toBe('default');
    });

    it('should return default cover when no active book', async () => {
      await store.removeBook('b1');
      await store.removeBook('b2');

      const cover = await store.getCover();
      expect(cover).toEqual({ title: '', author: '', bg: '', bgMobile: '' });
    });

    it('should update cover fields', async () => {
      await store.updateCover({ title: 'New Title', bgMode: 'custom', bgCustomData: 'http://img.jpg' });

      expect(mockApi.updateBook).toHaveBeenCalledWith('b1', {
        title: 'New Title',
        coverBgMode: 'custom',
        coverBgCustomUrl: 'http://img.jpg',
      });
    });
  });

  // ═══════════════════════════════════════════
  // Звуки
  // ═══════════════════════════════════════════

  describe('Sound management', () => {
    it('should get sounds for active book', async () => {
      const sounds = await store.getSounds();

      expect(mockApi.getSounds).toHaveBeenCalledWith('b1');
      expect(sounds).toEqual({
        pageFlip: '/sounds/flip.mp3',
        bookOpen: '/sounds/open.mp3',
        bookClose: '/sounds/close.mp3',
      });
    });

    it('should update sounds', async () => {
      await store.updateSounds({ pageFlip: '/new-flip.mp3' });

      expect(mockApi.updateSounds).toHaveBeenCalledWith('b1', { pageFlipUrl: '/new-flip.mp3' });
    });

    it('should return defaults when no active book', async () => {
      await store.removeBook('b1');
      await store.removeBook('b2');

      const sounds = await store.getSounds();
      expect(sounds).toEqual({ pageFlip: '', bookOpen: '', bookClose: '' });
    });
  });

  // ═══════════════════════════════════════════
  // Амбиенты
  // ═══════════════════════════════════════════

  describe('Ambient management', () => {
    it('should get ambients for active book', async () => {
      const ambients = await store.getAmbients();

      expect(ambients).toHaveLength(2);
      expect(ambients[0]).toMatchObject({
        id: 'rain',
        label: 'Дождь',
        icon: '🌧️',
        builtin: true,
      });
    });

    it('should add an ambient', async () => {
      await store.addAmbient({
        id: 'cafe',
        label: 'Кафе',
        shortLabel: 'Кафе',
        icon: '☕',
        file: '/cafe.mp3',
        visible: true,
      });

      expect(mockApi.createAmbient).toHaveBeenCalledWith('b1', expect.objectContaining({
        label: 'Кафе',
        icon: '☕',
        fileUrl: '/cafe.mp3',
      }));
    });

    it('should update an ambient by index', async () => {
      await store.updateAmbient(0, { label: 'Heavy Rain', visible: false });

      expect(mockApi.updateAmbient).toHaveBeenCalledWith('b1', 'a1', {
        label: 'Heavy Rain',
        visible: false,
      });
    });

    it('should remove an ambient by index', async () => {
      await store.removeAmbient(1);

      expect(mockApi.deleteAmbient).toHaveBeenCalledWith('b1', 'a2');
    });
  });

  // ═══════════════════════════════════════════
  // Оформление (Appearance)
  // ═══════════════════════════════════════════

  describe('Appearance management', () => {
    it('should get appearance with merged global settings', async () => {
      const appearance = await store.getAppearance();

      expect(mockApi.getAppearance).toHaveBeenCalledWith('b1');
      expect(appearance.fontMin).toBe(14);
      expect(appearance.fontMax).toBe(22);
      expect(appearance.light.coverBgStart).toBe('#3a2d1f');
      expect(appearance.dark.coverBgStart).toBe('#111');
    });

    it('should update global appearance settings', async () => {
      await store.updateAppearanceGlobal({ fontMin: 12, fontMax: 28 });

      expect(mockApi.updateSettings).toHaveBeenCalledWith({ fontMin: 12, fontMax: 28 });
      expect(mockApi.updateAppearance).toHaveBeenCalledWith('b1', { fontMin: 12, fontMax: 28 });
    });

    it('should update light theme appearance', async () => {
      await store.updateAppearanceTheme('light', {
        coverBgStart: '#444',
        bgPage: '#fff',
      });

      expect(mockApi.updateAppearanceTheme).toHaveBeenCalledWith('b1', 'light', {
        coverBgStart: '#444',
        bgPage: '#fff',
      });
    });

    it('should update dark theme appearance', async () => {
      await store.updateAppearanceTheme('dark', {
        coverBgStart: '#000',
        pageTexture: 'none',
      });

      expect(mockApi.updateAppearanceTheme).toHaveBeenCalledWith('b1', 'dark', {
        coverBgStart: '#000',
        pageTexture: 'none',
      });
    });

    it('should reject invalid theme name', async () => {
      await store.updateAppearanceTheme('sepia', { coverBgStart: '#444' });

      expect(mockApi.updateAppearanceTheme).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // Шрифты для чтения
  // ═══════════════════════════════════════════

  describe('Reading font management', () => {
    it('should get reading fonts from API', async () => {
      const fonts = await store.getReadingFonts();

      expect(fonts).toHaveLength(2);
      expect(fonts[0]).toMatchObject({
        id: 'georgia',
        label: 'Georgia',
        family: 'Georgia, serif',
        builtin: true,
      });
    });

    it('should add a custom reading font', async () => {
      await store.addReadingFont({
        id: 'custom-font',
        label: 'My Font',
        family: 'MyFont, sans-serif',
        builtin: false,
        enabled: true,
        dataUrl: 'data:font/woff2;base64,...',
      });

      expect(mockApi.createFont).toHaveBeenCalledWith(expect.objectContaining({
        fontKey: 'custom-font',
        label: 'My Font',
        family: 'MyFont, sans-serif',
        builtin: false,
        fileUrl: 'data:font/woff2;base64,...',
      }));
    });

    it('should update a reading font by index', async () => {
      await store.updateReadingFont(1, { enabled: false });

      expect(mockApi.updateFont).toHaveBeenCalledWith('f2', { enabled: false });
    });

    it('should remove a reading font by index', async () => {
      await store.removeReadingFont(0);

      expect(mockApi.deleteFont).toHaveBeenCalledWith('f1');
    });

    it('should handle out-of-range font index', async () => {
      await store.updateReadingFont(99, { enabled: false });

      expect(mockApi.updateFont).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // Настройки по умолчанию
  // ═══════════════════════════════════════════

  describe('Default settings management', () => {
    it('should get default settings for active book', async () => {
      const settings = await store.getDefaultSettings();

      expect(mockApi.getDefaultSettings).toHaveBeenCalledWith('b1');
      expect(settings).toEqual({ font: 'georgia', fontSize: 18, theme: 'light' });
    });

    it('should update default settings', async () => {
      await store.updateDefaultSettings({ font: 'inter', fontSize: 20 });

      expect(mockApi.updateDefaultSettings).toHaveBeenCalledWith('b1', {
        font: 'inter',
        fontSize: 20,
      });
    });
  });

  // ═══════════════════════════════════════════
  // Декоративный шрифт
  // ═══════════════════════════════════════════

  describe('Decorative font management', () => {
    it('should get decorative font', async () => {
      const font = await store.getDecorativeFont();

      expect(mockApi.getDecorativeFont).toHaveBeenCalledWith('b1');
      expect(font).toBeNull();
    });

    it('should set decorative font', async () => {
      await store.setDecorativeFont({ name: 'Fancy', dataUrl: 'data:...' });

      expect(mockApi.setDecorativeFont).toHaveBeenCalledWith('b1', {
        name: 'Fancy',
        fileUrl: 'data:...',
      });
    });

    it('should delete decorative font when null', async () => {
      await store.setDecorativeFont(null);

      expect(mockApi.deleteDecorativeFont).toHaveBeenCalledWith('b1');
    });
  });

  // ═══════════════════════════════════════════
  // Видимость настроек
  // ═══════════════════════════════════════════

  describe('Settings visibility', () => {
    it('should get settings visibility', async () => {
      const vis = await store.getSettingsVisibility();

      expect(vis.fontSize).toBe(true);
      expect(vis.sound).toBe(true);
    });

    it('should update settings visibility', async () => {
      await store.updateSettingsVisibility({ fontSize: false, ambient: false });

      expect(mockApi.updateSettings).toHaveBeenCalledWith({
        visFontSize: false,
        visAmbient: false,
      });
    });

    it('should return defaults when getSettings fails', async () => {
      mockApi.getSettings.mockRejectedValue(new Error('fail'));

      const vis = await store.getSettingsVisibility();

      expect(vis).toEqual({
        fontSize: true, theme: true, font: true,
        fullscreen: true, sound: true, ambient: true,
      });
    });
  });

  // ═══════════════════════════════════════════
  // Экспорт / Импорт
  // ═══════════════════════════════════════════

  describe('Export and import', () => {
    it('should export config as JSON string', async () => {
      mockApi.exportConfig.mockResolvedValue({
        books: [{ id: 'b1', title: 'Test' }],
        readingFonts: [],
      });

      const json = await store.exportJSON();

      expect(JSON.parse(json)).toEqual({
        books: [{ id: 'b1', title: 'Test' }],
        readingFonts: [],
      });
    });

    it('should import config and reload books', async () => {
      const importData = { books: [{ title: 'Imported' }], readingFonts: [] };
      mockApi.getBooks
        .mockResolvedValueOnce({ books: [makeBook('b1', 'Первая'), makeBook('b2', 'Вторая')] }) // init
        .mockResolvedValueOnce({ books: [makeBook('b-imp', 'Imported')] }); // after import

      // Re-create store to reset mock calls
      store = await ServerAdminConfigStore.create(mockApi);

      await store.importJSON(JSON.stringify(importData));

      expect(mockApi.importConfig).toHaveBeenCalledWith(importData);
      // Books reloaded after import
      expect(store.getBooks()).toHaveLength(1);
      expect(store.getBooks()[0].title).toBe('Imported');
      expect(store.getActiveBookId()).toBe('b-imp');
    });

    it('should handle invalid JSON on import', async () => {
      const onError = vi.fn();
      store.onError = onError;

      await expect(store.importJSON('not-json')).rejects.toThrow();

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Не удалось импортировать'));
    });
  });

  // ═══════════════════════════════════════════
  // Reset и Clear
  // ═══════════════════════════════════════════

  describe('Reset and clear', () => {
    it('should reset by deleting all books', async () => {
      await store.reset();

      expect(mockApi.deleteBook).toHaveBeenCalledTimes(2);
      expect(mockApi.deleteBook).toHaveBeenCalledWith('b1');
      expect(mockApi.deleteBook).toHaveBeenCalledWith('b2');
      expect(store.getBooks()).toHaveLength(0);
      expect(store.getActiveBookId()).toBe('');
    });

    it('clear should delegate to reset', async () => {
      await store.clear();

      expect(mockApi.deleteBook).toHaveBeenCalledTimes(2);
      expect(store.getBooks()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════
  // Error handling
  // ═══════════════════════════════════════════

  describe('Error handling and onError callback', () => {
    it('should call onError on chapter add failure', async () => {
      const onError = vi.fn();
      store.onError = onError;
      mockApi.createChapter.mockRejectedValue(new Error('DB error'));

      await expect(store.addChapter({ title: 'X' })).rejects.toThrow('DB error');

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Не удалось добавить главу'));
    });

    it('should call onError on sounds update failure', async () => {
      const onError = vi.fn();
      store.onError = onError;
      mockApi.updateSounds.mockRejectedValue(new Error('timeout'));

      await expect(store.updateSounds({ pageFlip: '/x.mp3' })).rejects.toThrow('timeout');
      expect(onError).toHaveBeenCalled();
    });

    it('should call onError on appearance theme update failure', async () => {
      const onError = vi.fn();
      store.onError = onError;
      mockApi.updateAppearanceTheme.mockRejectedValue(new Error('500'));

      await expect(store.updateAppearanceTheme('light', { bgPage: '#fff' })).rejects.toThrow('500');
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Не удалось обновить тему'));
    });

    it('should call onError on font add failure', async () => {
      const onError = vi.fn();
      store.onError = onError;
      mockApi.createFont.mockRejectedValue(new Error('limit'));

      await expect(store.addReadingFont({ label: 'F' })).rejects.toThrow('limit');
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Не удалось добавить шрифт'));
    });

    it('should call onError on reset failure', async () => {
      const onError = vi.fn();
      store.onError = onError;
      mockApi.deleteBook.mockRejectedValue(new Error('forbidden'));

      await expect(store.reset()).rejects.toThrow('forbidden');
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Не удалось сбросить'));
    });
  });

  // ═══════════════════════════════════════════
  // Full lifecycle scenario
  // ═══════════════════════════════════════════

  describe('Full lifecycle: create book → add content → customize → export', () => {
    it('should manage a book through its complete lifecycle', async () => {
      // 1. Create book
      mockApi.createBook.mockResolvedValue({ id: 'b3', title: 'Новый роман', author: 'Я' });
      const book = await store.addBook({ cover: { title: 'Новый роман', author: 'Я' } });
      expect(book.id).toBe('b3');

      // 2. Switch to new book
      store.setActiveBook('b3');
      expect(store.getActiveBookId()).toBe('b3');

      // 3. Add chapters
      await store.addChapter({ title: 'Пролог', htmlContent: '<p>Начало...</p>' });
      await store.addChapter({ title: 'Глава 1', htmlContent: '<p>Текст</p>' });
      expect(mockApi.createChapter).toHaveBeenCalledTimes(2);

      // 4. Configure sounds
      await store.updateSounds({
        pageFlip: '/custom-flip.mp3',
        bookOpen: '/custom-open.mp3',
      });
      expect(mockApi.updateSounds).toHaveBeenCalledWith('b3', {
        pageFlipUrl: '/custom-flip.mp3',
        bookOpenUrl: '/custom-open.mp3',
      });

      // 5. Add ambient
      await store.addAmbient({
        id: 'forest',
        label: 'Лес',
        icon: '🌲',
        file: '/forest.mp3',
      });

      // 6. Customize appearance
      await store.updateAppearanceTheme('light', {
        coverBgStart: '#1a5276',
        coverBgEnd: '#154360',
        coverText: '#ffffff',
        bgPage: '#fafaf5',
      });

      // 7. Set default reader settings
      await store.updateDefaultSettings({
        font: 'merriweather',
        fontSize: 20,
        theme: 'dark',
      });

      // 8. Set decorative font
      await store.setDecorativeFont({ name: 'OldEnglish', dataUrl: 'data:font/...' });

      // 9. Export config
      await store.exportJSON();
      expect(mockApi.exportConfig).toHaveBeenCalled();

      // 10. Verify all API calls went to the right book
      expect(mockApi.createChapter.mock.calls.every(c => c[0] === 'b3')).toBe(true);
      expect(mockApi.updateSounds).toHaveBeenCalledWith('b3', expect.any(Object));
      expect(mockApi.createAmbient).toHaveBeenCalledWith('b3', expect.any(Object));
      expect(mockApi.updateAppearanceTheme).toHaveBeenCalledWith('b3', 'light', expect.any(Object));
      expect(mockApi.updateDefaultSettings).toHaveBeenCalledWith('b3', expect.any(Object));
      expect(mockApi.setDecorativeFont).toHaveBeenCalledWith('b3', expect.any(Object));
    });
  });

  // ═══════════════════════════════════════════
  // waitForSave
  // ═══════════════════════════════════════════

  describe('waitForSave', () => {
    it('should resolve immediately when no save pending', async () => {
      await expect(store.waitForSave()).resolves.toBeUndefined();
    });

    it('should wait for pending save promise', async () => {
      let resolveSave;
      store._savePromise = new Promise(r => { resolveSave = r; });

      let waited = false;
      const waitPromise = store.waitForSave().then(() => { waited = true; });

      expect(waited).toBe(false);
      resolveSave();
      await waitPromise;
      expect(waited).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // getConfig и empty init
  // ═══════════════════════════════════════════

  describe('getConfig and empty init', () => {
    it('should delegate getConfig to exportConfig', async () => {
      await store.getConfig();
      expect(mockApi.exportConfig).toHaveBeenCalled();
    });

    it('should handle empty books on init', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });
      const emptyStore = await ServerAdminConfigStore.create(mockApi);

      expect(emptyStore.getActiveBookId()).toBeNull();
      expect(emptyStore.getBooks()).toHaveLength(0);
    });
  });
});
