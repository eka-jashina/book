/**
 * TESTS: AdminConfigStore
 * Тесты для хранилища конфигурации админ-панели
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminConfigStore } from '../../../js/admin/AdminConfigStore.js';
import { mergeWithDefaults } from '../../../js/admin/AdminConfigMigration.js';

// Мок IndexedDB — AdminConfigStore при инициализации обращается к IDB
const createIDBMock = () => {
  const store = {};

  const mockObjectStore = {
    get: vi.fn((key) => {
      const request = {
        result: store[key] ?? undefined,
        onsuccess: null,
        onerror: null,
      };
      setTimeout(() => request.onsuccess?.());
      return request;
    }),
    put: vi.fn((value, key) => {
      store[key] = structuredClone(value);
      const request = { onsuccess: null, onerror: null };
      setTimeout(() => request.onsuccess?.());
      return request;
    }),
    delete: vi.fn((key) => {
      delete store[key];
      const request = { onsuccess: null, onerror: null };
      setTimeout(() => request.onsuccess?.());
      return request;
    }),
  };

  const mockTransaction = {
    objectStore: vi.fn(() => mockObjectStore),
    oncomplete: null,
    onerror: null,
  };
  // Авто-complete транзакции
  const origObjectStore = mockTransaction.objectStore;
  mockTransaction.objectStore = vi.fn((...args) => {
    const result = origObjectStore(...args);
    setTimeout(() => mockTransaction.oncomplete?.());
    return result;
  });

  const mockDB = {
    transaction: vi.fn(() => mockTransaction),
    objectStoreNames: { contains: vi.fn(() => true) },
    createObjectStore: vi.fn(),
    close: vi.fn(),
  };

  const mockRequest = {
    result: mockDB,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };

  return {
    open: vi.fn(() => {
      setTimeout(() => mockRequest.onsuccess?.());
      return mockRequest;
    }),
    _store: store,
    _mockDB: mockDB,
  };
};

/**
 * Создать AdminConfigStore синхронно (без IDB загрузки)
 * Для тестов, которые не нуждаются в асинхронной инициализации
 */
function createStore() {
  return new AdminConfigStore();
}

describe('AdminConfigStore', () => {
  let store;

  beforeEach(() => {
    // Мок IndexedDB глобально
    global.indexedDB = createIDBMock();
    store = createStore();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR & DEFAULTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor & defaults', () => {
    it('should initialize with default config', () => {
      const config = store.getConfig();
      expect(config).toBeDefined();
      expect(config.books).toBeInstanceOf(Array);
      expect(config.books.length).toBe(1);
      expect(config.activeBookId).toBe('default');
    });

    it('should have default book with correct structure', () => {
      const config = store.getConfig();
      const book = config.books[0];
      expect(book.id).toBe('default');
      expect(book.cover).toBeDefined();
      expect(book.cover.title).toBe('Sample Book');
      expect(book.cover.author).toBe('Flipbook Demo');
      expect(book.chapters).toBeInstanceOf(Array);
      expect(book.chapters.length).toBe(3);
    });

    it('should have default global settings', () => {
      const config = store.getConfig();
      expect(config.fontMin).toBe(14);
      expect(config.fontMax).toBe(22);
      expect(config.readingFonts).toBeInstanceOf(Array);
      expect(config.readingFonts.length).toBe(6);
      expect(config.settingsVisibility).toEqual({
        fontSize: true,
        theme: true,
        font: true,
        fullscreen: true,
        sound: true,
        ambient: true,
      });
    });

    it('should return deep clones from getConfig', () => {
      const c1 = store.getConfig();
      const c2 = store.getConfig();
      expect(c1).toEqual(c2);
      c1.books[0].cover.title = 'changed';
      expect(store.getConfig().books[0].cover.title).toBe('Sample Book');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKS CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  describe('books CRUD', () => {
    it('should list books with getBooks()', () => {
      const books = store.getBooks();
      expect(books.length).toBe(1);
      expect(books[0]).toEqual({
        id: 'default',
        title: 'Sample Book',
        author: 'Flipbook Demo',
        type: 'book',
        chaptersCount: 3,
      });
    });

    it('should return active book ID', () => {
      expect(store.getActiveBookId()).toBe('default');
    });

    it('should add a new book', () => {
      store.addBook({
        id: 'book2',
        cover: { title: 'Test Book', author: 'Author', bg: '', bgMobile: '' },
        chapters: [{ id: 'ch1', file: 'ch1.html' }],
      });

      const books = store.getBooks();
      expect(books.length).toBe(2);
      expect(books[1].id).toBe('book2');
      expect(books[1].title).toBe('Test Book');
      expect(books[1].chaptersCount).toBe(1);
    });

    it('should generate book id if not provided', () => {
      store.addBook({ cover: { title: 'No ID', author: '' } });
      const books = store.getBooks();
      expect(books[1].id).toMatch(/^book_\d+$/);
    });

    it('should add book with default per-book settings', () => {
      store.addBook({ id: 'new', cover: { title: 'New', author: '' } });
      store.setActiveBook('new');

      const settings = store.getDefaultSettings();
      expect(settings.font).toBe('georgia');
      expect(settings.fontSize).toBe(18);
      expect(settings.theme).toBe('light');
    });

    it('should remove a book', () => {
      store.addBook({ id: 'book2', cover: { title: 'Book 2' } });
      expect(store.getBooks().length).toBe(2);

      store.removeBook('book2');
      expect(store.getBooks().length).toBe(1);
      expect(store.getBooks()[0].id).toBe('default');
    });

    it('should switch active book to first when active is removed', () => {
      store.addBook({ id: 'book2', cover: { title: 'Book 2' } });
      store.setActiveBook('book2');
      expect(store.getActiveBookId()).toBe('book2');

      store.removeBook('book2');
      expect(store.getActiveBookId()).toBe('default');
    });

    it('should not remove non-existent book', () => {
      store.removeBook('nonexistent');
      expect(store.getBooks().length).toBe(1);
    });

    it('should set active book', () => {
      store.addBook({ id: 'book2', cover: { title: 'Book 2' } });
      store.setActiveBook('book2');
      expect(store.getActiveBookId()).toBe('book2');
    });

    it('should not set active book to non-existent id', () => {
      store.setActiveBook('nonexistent');
      expect(store.getActiveBookId()).toBe('default');
    });

    it('should update book meta', () => {
      store.updateBookMeta('default', { title: 'New Title', author: 'New Author' });
      const cover = store.getCover();
      expect(cover.title).toBe('New Title');
      expect(cover.author).toBe('New Author');
    });

    it('should not update meta for non-existent book', () => {
      store.updateBookMeta('nonexistent', { title: 'Test' });
      // Не должно бросить ошибку
      expect(store.getCover().title).toBe('Sample Book');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COVER
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cover', () => {
    it('should get cover of active book', () => {
      const cover = store.getCover();
      expect(cover.title).toBe('Sample Book');
      expect(cover.author).toBe('Flipbook Demo');
      expect(cover.bg).toBeDefined();
    });

    it('should return deep clone of cover', () => {
      const c1 = store.getCover();
      c1.title = 'changed';
      expect(store.getCover().title).toBe('Sample Book');
    });

    it('should update cover', () => {
      store.updateCover({ title: 'Updated Title' });
      expect(store.getCover().title).toBe('Updated Title');
      // Другие поля сохраняются
      expect(store.getCover().author).toBe('Flipbook Demo');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CHAPTERS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('chapters', () => {
    it('should get chapters of active book', () => {
      const chapters = store.getChapters();
      expect(chapters.length).toBe(3);
      expect(chapters[0].id).toBe('part_1');
    });

    it('should return deep clone of chapters', () => {
      const c1 = store.getChapters();
      c1[0].id = 'changed';
      expect(store.getChapters()[0].id).toBe('part_1');
    });

    it('should add a chapter', () => {
      store.addChapter({ id: 'part_4', file: 'content/part_4.html', bg: '', bgMobile: '' });
      const chapters = store.getChapters();
      expect(chapters.length).toBe(4);
      expect(chapters[3].id).toBe('part_4');
    });

    it('should update a chapter', () => {
      store.updateChapter(0, { id: 'updated', file: 'content/updated.html', bg: 'new_bg.webp', bgMobile: '' });
      expect(store.getChapters()[0].id).toBe('updated');
      expect(store.getChapters()[0].file).toBe('content/updated.html');
    });

    it('should not update chapter at invalid index', () => {
      store.updateChapter(-1, { id: 'bad' });
      store.updateChapter(100, { id: 'bad' });
      expect(store.getChapters()[0].id).toBe('part_1');
    });

    it('should remove a chapter', () => {
      store.removeChapter(1);
      const chapters = store.getChapters();
      expect(chapters.length).toBe(2);
      expect(chapters[0].id).toBe('part_1');
      expect(chapters[1].id).toBe('part_3');
    });

    it('should not remove chapter at invalid index', () => {
      store.removeChapter(-1);
      store.removeChapter(100);
      expect(store.getChapters().length).toBe(3);
    });

    it('should move a chapter', () => {
      store.moveChapter(0, 2);
      const chapters = store.getChapters();
      expect(chapters[0].id).toBe('part_2');
      expect(chapters[1].id).toBe('part_3');
      expect(chapters[2].id).toBe('part_1');
    });

    it('should not move chapter with invalid indices', () => {
      store.moveChapter(-1, 0);
      store.moveChapter(0, -1);
      store.moveChapter(100, 0);
      store.moveChapter(0, 100);
      expect(store.getChapters()[0].id).toBe('part_1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DEFAULT SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('default settings', () => {
    it('should get default settings', () => {
      const s = store.getDefaultSettings();
      expect(s.font).toBe('georgia');
      expect(s.fontSize).toBe(18);
      expect(s.theme).toBe('light');
      expect(s.soundEnabled).toBe(true);
      expect(s.soundVolume).toBe(0.3);
      expect(s.ambientType).toBe('none');
      expect(s.ambientVolume).toBe(0.5);
    });

    it('should return deep clone of settings', () => {
      const s = store.getDefaultSettings();
      s.font = 'changed';
      expect(store.getDefaultSettings().font).toBe('georgia');
    });

    it('should update default settings partially', () => {
      store.updateDefaultSettings({ font: 'inter', fontSize: 20 });
      const s = store.getDefaultSettings();
      expect(s.font).toBe('inter');
      expect(s.fontSize).toBe(20);
      expect(s.theme).toBe('light'); // Не изменено
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUNDS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('sounds', () => {
    it('should get default sounds', () => {
      const sounds = store.getSounds();
      expect(sounds.pageFlip).toBe('sounds/page-flip.mp3');
      expect(sounds.bookOpen).toBe('sounds/cover-flip.mp3');
      expect(sounds.bookClose).toBe('sounds/cover-flip.mp3');
    });

    it('should return deep clone of sounds', () => {
      const s = store.getSounds();
      s.pageFlip = 'changed';
      expect(store.getSounds().pageFlip).toBe('sounds/page-flip.mp3');
    });

    it('should update sounds partially', () => {
      store.updateSounds({ pageFlip: 'custom/flip.mp3' });
      const sounds = store.getSounds();
      expect(sounds.pageFlip).toBe('custom/flip.mp3');
      expect(sounds.bookOpen).toBe('sounds/cover-flip.mp3');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AMBIENTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ambients', () => {
    it('should get default ambients', () => {
      const ambients = store.getAmbients();
      expect(ambients.length).toBe(4);
      expect(ambients[0].id).toBe('none');
      expect(ambients[1].id).toBe('rain');
      expect(ambients[2].id).toBe('fireplace');
      expect(ambients[3].id).toBe('cafe');
    });

    it('should return deep clone of ambients', () => {
      const a = store.getAmbients();
      a[0].label = 'changed';
      expect(store.getAmbients()[0].label).toBe('Без звука');
    });

    it('should add an ambient', () => {
      store.addAmbient({ id: 'ocean', label: 'Океан', icon: '🌊', file: 'ocean.mp3', visible: true });
      const ambients = store.getAmbients();
      expect(ambients.length).toBe(5);
      expect(ambients[4].id).toBe('ocean');
    });

    it('should update an ambient', () => {
      store.updateAmbient(1, { label: 'Heavy Rain' });
      expect(store.getAmbients()[1].label).toBe('Heavy Rain');
      expect(store.getAmbients()[1].id).toBe('rain'); // Другие поля сохранены
    });

    it('should not update ambient at invalid index', () => {
      store.updateAmbient(-1, { label: 'bad' });
      store.updateAmbient(100, { label: 'bad' });
      expect(store.getAmbients()[0].label).toBe('Без звука');
    });

    it('should remove an ambient', () => {
      store.removeAmbient(3);
      const ambients = store.getAmbients();
      expect(ambients.length).toBe(3);
      expect(ambients.every(a => a.id !== 'cafe')).toBe(true);
    });

    it('should not remove ambient at invalid index', () => {
      store.removeAmbient(-1);
      store.removeAmbient(100);
      expect(store.getAmbients().length).toBe(4);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // APPEARANCE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('appearance', () => {
    it('should get appearance with global and per-theme fields', () => {
      const a = store.getAppearance();
      expect(a.fontMin).toBe(14);
      expect(a.fontMax).toBe(22);
      expect(a.light).toBeDefined();
      expect(a.dark).toBeDefined();
      expect(a.light.coverBgStart).toBe('#3a2d1f');
      expect(a.dark.coverBgStart).toBe('#111111');
    });

    it('should return deep clone of appearance', () => {
      const a = store.getAppearance();
      a.light.coverBgStart = 'changed';
      expect(store.getAppearance().light.coverBgStart).toBe('#3a2d1f');
    });

    it('should update global appearance fields', () => {
      store.updateAppearanceGlobal({ fontMin: 12, fontMax: 24 });
      const a = store.getAppearance();
      expect(a.fontMin).toBe(12);
      expect(a.fontMax).toBe(24);
    });

    it('should update light theme appearance', () => {
      store.updateAppearanceTheme('light', { coverBgStart: '#ff0000' });
      expect(store.getAppearance().light.coverBgStart).toBe('#ff0000');
      expect(store.getAppearance().dark.coverBgStart).toBe('#111111'); // Не затронута
    });

    it('should update dark theme appearance', () => {
      store.updateAppearanceTheme('dark', { bgPage: '#2a2a2a' });
      expect(store.getAppearance().dark.bgPage).toBe('#2a2a2a');
      expect(store.getAppearance().light.bgPage).toBe('#fdfcf8'); // Не затронута
    });

    it('should ignore invalid theme name', () => {
      store.updateAppearanceTheme('invalid', { coverBgStart: '#ff0000' });
      expect(store.getAppearance().light.coverBgStart).toBe('#3a2d1f');
      expect(store.getAppearance().dark.coverBgStart).toBe('#111111');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DECORATIVE FONT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('decorative font', () => {
    it('should return null by default', () => {
      expect(store.getDecorativeFont()).toBeNull();
    });

    it('should set decorative font', () => {
      store.setDecorativeFont({ name: 'MyFont', dataUrl: 'data:font/woff2;base64,abc' });
      const font = store.getDecorativeFont();
      expect(font.name).toBe('MyFont');
      expect(font.dataUrl).toBe('data:font/woff2;base64,abc');
    });

    it('should clear decorative font', () => {
      store.setDecorativeFont({ name: 'MyFont', dataUrl: 'data:abc' });
      store.setDecorativeFont(null);
      expect(store.getDecorativeFont()).toBeNull();
    });

    it('should return clone of decorative font', () => {
      store.setDecorativeFont({ name: 'MyFont', dataUrl: 'data:abc' });
      const f = store.getDecorativeFont();
      f.name = 'changed';
      expect(store.getDecorativeFont().name).toBe('MyFont');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // READING FONTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('reading fonts', () => {
    it('should get default reading fonts', () => {
      const fonts = store.getReadingFonts();
      expect(fonts.length).toBe(6);
      expect(fonts[0].id).toBe('georgia');
      expect(fonts[0].builtin).toBe(true);
      expect(fonts[0].enabled).toBe(true);
    });

    it('should return deep clone of reading fonts', () => {
      const f = store.getReadingFonts();
      f[0].label = 'changed';
      expect(store.getReadingFonts()[0].label).toBe('Georgia');
    });

    it('should add a reading font', () => {
      store.addReadingFont({
        id: 'custom_1',
        label: 'CustomFont',
        family: '"CustomFont", serif',
        builtin: false,
        enabled: true,
      });
      const fonts = store.getReadingFonts();
      expect(fonts.length).toBe(7);
      expect(fonts[6].id).toBe('custom_1');
    });

    it('should update a reading font', () => {
      store.updateReadingFont(0, { enabled: false });
      expect(store.getReadingFonts()[0].enabled).toBe(false);
      expect(store.getReadingFonts()[0].id).toBe('georgia'); // Другие поля сохранены
    });

    it('should not update reading font at invalid index', () => {
      store.updateReadingFont(-1, { enabled: false });
      store.updateReadingFont(100, { enabled: false });
      expect(store.getReadingFonts()[0].enabled).toBe(true);
    });

    it('should remove a reading font', () => {
      store.removeReadingFont(5);
      expect(store.getReadingFonts().length).toBe(5);
    });

    it('should not remove reading font at invalid index', () => {
      store.removeReadingFont(-1);
      store.removeReadingFont(100);
      expect(store.getReadingFonts().length).toBe(6);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SETTINGS VISIBILITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('settings visibility', () => {
    it('should get default visibility', () => {
      const v = store.getSettingsVisibility();
      expect(v).toEqual({
        fontSize: true,
        theme: true,
        font: true,
        fullscreen: true,
        sound: true,
        ambient: true,
      });
    });

    it('should update visibility partially', () => {
      store.updateSettingsVisibility({ fontSize: false, ambient: false });
      const v = store.getSettingsVisibility();
      expect(v.fontSize).toBe(false);
      expect(v.ambient).toBe(false);
      expect(v.theme).toBe(true); // Не изменено
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPORT / IMPORT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('export / import', () => {
    it('should export JSON string', () => {
      const json = store.exportJSON();
      const parsed = JSON.parse(json);
      expect(parsed.books).toBeDefined();
      expect(parsed.activeBookId).toBe('default');
    });

    it('should import valid JSON', () => {
      const modified = store.getConfig();
      modified.fontMin = 10;
      modified.fontMax = 30;
      modified.books[0].cover.title = 'Imported Title';

      store.importJSON(JSON.stringify(modified));
      expect(store.getAppearance().fontMin).toBe(10);
      expect(store.getCover().title).toBe('Imported Title');
    });

    it('should throw on invalid JSON', () => {
      expect(() => store.importJSON('not json')).toThrow();
    });

    it('should merge imported data with defaults', () => {
      // Импортируем неполные данные — должны дополниться дефолтами
      store.importJSON(JSON.stringify({ books: [{ id: 'minimal', cover: { title: 'Min' } }] }));
      const config = store.getConfig();
      expect(config.fontMin).toBe(14);
      expect(config.readingFonts.length).toBe(6);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RESET & CLEAR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('reset & clear', () => {
    it('should reset to defaults', () => {
      store.updateAppearanceGlobal({ fontMin: 10 });
      store.updateCover({ title: 'Changed' });
      store.addBook({ id: 'extra', cover: { title: 'Extra' } });

      store.reset();

      expect(store.getAppearance().fontMin).toBe(14);
      expect(store.getCover().title).toBe('Sample Book');
      expect(store.getBooks().length).toBe(1);
    });

    it('should clear config and storage', () => {
      store.updateCover({ title: 'Changed' });
      store.clear();

      expect(store.getCover().title).toBe('Sample Book');
      expect(store.getBooks().length).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTI-BOOK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('multi-book operations', () => {
    beforeEach(() => {
      store.addBook({
        id: 'book2',
        cover: { title: 'Second Book', author: 'Author 2', bg: '', bgMobile: '' },
        chapters: [{ id: 'ch2_1', file: 'ch2.html' }],
      });
    });

    it('should operate on active book chapters', () => {
      // Активна дефолтная книга
      expect(store.getChapters().length).toBe(3);

      store.setActiveBook('book2');
      expect(store.getChapters().length).toBe(1);
      expect(store.getChapters()[0].id).toBe('ch2_1');
    });

    it('should operate on active book cover', () => {
      expect(store.getCover().title).toBe('Sample Book');

      store.setActiveBook('book2');
      expect(store.getCover().title).toBe('Second Book');
    });

    it('should operate on active book settings independently', () => {
      store.updateDefaultSettings({ font: 'inter' });
      expect(store.getDefaultSettings().font).toBe('inter');

      store.setActiveBook('book2');
      expect(store.getDefaultSettings().font).toBe('georgia'); // Дефолт для новой книги
    });

    it('should operate on active book sounds independently', () => {
      store.updateSounds({ pageFlip: 'custom.mp3' });

      store.setActiveBook('book2');
      expect(store.getSounds().pageFlip).toBe('sounds/page-flip.mp3');
    });

    it('should operate on active book ambients independently', () => {
      store.addAmbient({ id: 'custom', label: 'Custom', icon: '🎵', file: 'c.mp3' });
      expect(store.getAmbients().length).toBe(5);

      store.setActiveBook('book2');
      expect(store.getAmbients().length).toBe(4);
    });

    it('should operate on active book appearance independently', () => {
      store.updateAppearanceTheme('light', { coverBgStart: '#ff0000' });

      store.setActiveBook('book2');
      expect(store.getAppearance().light.coverBgStart).toBe('#3a2d1f');
    });

    it('should operate on active book decorative font independently', () => {
      store.setDecorativeFont({ name: 'Font1', dataUrl: 'data:abc' });

      store.setActiveBook('book2');
      expect(store.getDecorativeFont()).toBeNull();
    });

    it('should share global settings across books', () => {
      store.updateAppearanceGlobal({ fontMin: 10 });
      expect(store.getAppearance().fontMin).toBe(10);

      store.setActiveBook('book2');
      expect(store.getAppearance().fontMin).toBe(10); // Глобальные — общие
    });

    it('should share reading fonts across books', () => {
      store.addReadingFont({ id: 'custom', label: 'Custom', family: 'Custom', builtin: false, enabled: true });
      expect(store.getReadingFonts().length).toBe(7);

      store.setActiveBook('book2');
      expect(store.getReadingFonts().length).toBe(7); // Глобальные
    });

    it('should share settings visibility across books', () => {
      store.updateSettingsVisibility({ fontSize: false });

      store.setActiveBook('book2');
      expect(store.getSettingsVisibility().fontSize).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE WITH DEFAULTS (миграция)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('mergeWithDefaults', () => {
    it('should handle empty saved data', () => {
      const result = mergeWithDefaults({});
      expect(result.books).toBeDefined();
      expect(result.books.length).toBeGreaterThan(0);
      expect(result.fontMin).toBe(14);
      expect(result.readingFonts.length).toBe(6);
    });

    it('should migrate old format with top-level cover/chapters', () => {
      const oldFormat = {
        cover: { title: 'Old Book', author: 'Old Author' },
        chapters: [{ id: 'ch1', file: 'ch1.html' }],
      };
      const result = mergeWithDefaults(oldFormat);
      expect(result.books.length).toBe(1);
      expect(result.books[0].cover.title).toBe('Old Book');
      expect(result.books[0].chapters[0].id).toBe('ch1');
    });

    it('should migrate old format with top-level settings', () => {
      const oldFormat = {
        books: [{ id: 'test', cover: { title: 'Test' }, chapters: [] }],
        defaultSettings: { font: 'roboto', fontSize: 20 },
      };
      const result = mergeWithDefaults(oldFormat);
      expect(result.books[0].defaultSettings.font).toBe('roboto');
      expect(result.books[0].defaultSettings.fontSize).toBe(20);
    });

    it('should migrate fontMin/fontMax from appearance to top level', () => {
      const oldFormat = {
        books: [{ id: 'test', cover: { title: 'Test' }, chapters: [] }],
        appearance: { fontMin: 12, fontMax: 26 },
      };
      const result = mergeWithDefaults(oldFormat);
      expect(result.fontMin).toBe(12);
      expect(result.fontMax).toBe(26);
    });

    it('should use first book id as activeBookId when not specified', () => {
      const data = {
        books: [{ id: 'mybook', cover: { title: 'Test' }, chapters: [] }],
      };
      const result = mergeWithDefaults(data);
      expect(result.activeBookId).toBe('mybook');
    });

    it('should preserve saved activeBookId', () => {
      const data = {
        books: [
          { id: 'book1', cover: { title: '1' }, chapters: [] },
          { id: 'book2', cover: { title: '2' }, chapters: [] },
        ],
        activeBookId: 'book2',
      };
      const result = mergeWithDefaults(data);
      expect(result.activeBookId).toBe('book2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_save', () => {
    it('should save to localStorage on mutations', () => {
      localStorage.clear();
      store.updateCover({ title: 'Saved Title' });

      expect(localStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(savedData.books[0].cover.title).toBe('Saved Title');
    });

    it('should save with correct storage key', () => {
      store.updateCover({ title: 'Test' });
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'flipbook-admin-config',
        expect.any(String)
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ASYNC CREATE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('static create()', () => {
    it('should create store instance asynchronously', async () => {
      const asyncStore = await AdminConfigStore.create();
      expect(asyncStore).toBeInstanceOf(AdminConfigStore);
      expect(asyncStore.getBooks().length).toBeGreaterThan(0);
    });

    it('should load from localStorage when IDB is empty', async () => {
      const config = {
        books: [{
          id: 'saved',
          cover: { title: 'From LS', author: '' },
          chapters: [],
        }],
        activeBookId: 'saved',
      };
      localStorage.setItem('flipbook-admin-config', JSON.stringify(config));

      const asyncStore = await AdminConfigStore.create();
      expect(asyncStore.getBooks()[0].title).toBe('From LS');
    });
  });
});
