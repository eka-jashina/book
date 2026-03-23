/**
 * INTEGRATION TEST: Book Switching Lifecycle
 * Тестирование полного цикла переключения книг через API:
 * BookshelfScreen выбор книги → loadConfigFromAPI → setConfig →
 * SettingsManager per-book → чтение → возврат на полку → другая книга.
 *
 * В отличие от multiBookSession.test.js (низкоуровневый: delegates + state machine),
 * этот тест проверяет верхний уровень: config loading, bookshelf, progress API.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createConfigFromAPI,
  loadConfigFromAPI,
  getConfig,
  setConfig,
} from '../../../js/config.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';
import {
  BookshelfScreen,
  loadBooksFromAPI,
} from '../../../js/core/BookshelfScreen.js';

// Mock admin mode cards data
vi.mock('../../../js/admin/modeCardsData.js', () => ({
  renderModeCards: vi.fn(),
}));

describe('Book Switching Lifecycle Integration', () => {
  /** @type {Object} */
  let mockApi;

  // ── Тестовые данные ──

  const makeBookDetail = (id, title, opts = {}) => ({
    id,
    title,
    author: opts.author || '',
    cover: { bg: '', bgMobile: '', bgMode: 'default' },
    chapters: opts.chapters || [
      { id: 'ch1', title: 'Chapter 1', filePath: '', hasHtmlContent: true, bg: '', bgMobile: '' },
    ],
    sounds: opts.sounds || { pageFlip: '', bookOpen: '', bookClose: '' },
    ambients: opts.ambients || [],
    appearance: opts.appearance || {
      fontMin: 14, fontMax: 22,
      light: { coverBgStart: '#333', coverBgEnd: '#222', coverText: '#fff' },
      dark: { coverBgStart: '#111', coverBgEnd: '#000', coverText: '#eee' },
    },
    defaultSettings: opts.defaultSettings || { font: 'georgia', fontSize: 18, theme: 'light' },
    decorativeFont: opts.decorativeFont || null,
  });

  const globalSettings = {
    fontMin: 14, fontMax: 24,
    settingsVisibility: {
      fontSize: true, theme: true, font: true,
      fullscreen: true, sound: true, ambient: true,
    },
  };

  const readingFonts = [
    { id: 'f1', fontKey: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true, fileUrl: null },
    { id: 'f2', fontKey: 'inter', label: 'Inter', family: 'Inter, sans-serif', builtin: true, enabled: true, fileUrl: null },
  ];

  const bookDetailA = makeBookDetail('book-a', 'Книга A', {
    author: 'Автор A',
    defaultSettings: { font: 'georgia', fontSize: 18, theme: 'light' },
    chapters: [
      { id: 'a-ch1', title: 'A: Глава 1', filePath: '', hasHtmlContent: true, bg: '', bgMobile: '' },
      { id: 'a-ch2', title: 'A: Глава 2', filePath: '', hasHtmlContent: true, bg: '', bgMobile: '' },
    ],
  });

  const bookDetailB = makeBookDetail('book-b', 'Книга B', {
    author: 'Автор B',
    defaultSettings: { font: 'inter', fontSize: 20, theme: 'dark' },
    chapters: [
      { id: 'b-ch1', title: 'B: Глава 1', filePath: '', hasHtmlContent: true, bg: '', bgMobile: '' },
    ],
    ambients: [
      { id: 'amb1', ambientKey: 'rain', label: 'Дождь', shortLabel: 'Дождь', icon: '🌧️', fileUrl: '/rain.mp3', visible: true },
    ],
  });

  const createMockApi = () => ({
    getBooks: vi.fn().mockResolvedValue({ books: [
      { id: 'book-a', title: 'Книга A', author: 'Автор A', chaptersCount: 2 },
      { id: 'book-b', title: 'Книга B', author: 'Автор B', chaptersCount: 1 },
    ]}),
    getBook: vi.fn().mockImplementation((bookId) => {
      if (bookId === 'book-a') return Promise.resolve(bookDetailA);
      if (bookId === 'book-b') return Promise.resolve(bookDetailB);
      return Promise.reject(new Error('Not found'));
    }),
    getSettings: vi.fn().mockResolvedValue(globalSettings),
    getFonts: vi.fn().mockResolvedValue({ fonts: readingFonts }),
    getProgress: vi.fn().mockResolvedValue({ page: 0, chapter: 0 }),
    saveProgress: vi.fn().mockResolvedValue({}),
    deleteBook: vi.fn().mockResolvedValue({}),
  });

  const createBookshelfDOM = () => {
    const container = document.createElement('div');
    container.id = 'bookshelf';

    for (const [id, cls] of [
      ['bookshelf-shelves', ''],
      ['bookshelf-actions', ''],
      ['bookshelf-empty', ''],
      ['bookshelf-subtitle', ''],
      ['bookshelf-mode-selector', ''],
    ]) {
      const el = document.createElement('div');
      el.id = id;
      if (id === 'bookshelf-empty' || id === 'bookshelf-mode-selector') el.hidden = true;
      container.appendChild(el);
    }

    const header = document.createElement('div');
    header.className = 'bookshelf-header';
    container.appendChild(header);

    // Templates
    const shelfTmpl = document.createElement('template');
    shelfTmpl.id = 'tmpl-bookshelf-shelf';
    shelfTmpl.innerHTML = '<div class="bookshelf-shelf"><div class="bookshelf-books"></div></div>';
    document.body.appendChild(shelfTmpl);

    const bookTmpl = document.createElement('template');
    bookTmpl.id = 'tmpl-bookshelf-book';
    bookTmpl.innerHTML = `
      <div class="bookshelf-book-wrapper">
        <button class="bookshelf-book">
          <div class="bookshelf-book-cover">
            <span class="bookshelf-book-title"></span>
            <span class="bookshelf-book-author"></span>
          </div>
        </button>
        <div class="bookshelf-book-menu" hidden>
          <button data-book-action="read">Читать</button>
          <button data-book-action="edit">Редактировать</button>
          <button data-book-action="delete">Удалить</button>
        </div>
      </div>
    `;
    document.body.appendChild(bookTmpl);

    document.body.appendChild(container);
    return container;
  };

  let originalConfig;

  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    mockApi = createMockApi();
    originalConfig = getConfig();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    setConfig(originalConfig);
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // Config loading from API
  // ═══════════════════════════════════════════

  describe('Config loading from API', () => {
    it('should load config for book A with correct chapters and settings', async () => {
      const config = await loadConfigFromAPI(mockApi, 'book-a');

      expect(config.BOOK_ID).toBe('book-a');
      expect(config.STORAGE_KEY).toBe('reader-settings:book-a');
      expect(config.CHAPTERS).toHaveLength(2);
      expect(config.CHAPTERS[0].title).toBe('A: Глава 1');
      expect(config.DEFAULT_SETTINGS.font).toBe('georgia');
      expect(config.DEFAULT_SETTINGS.fontSize).toBe(18);
      expect(config.APPEARANCE.coverTitle).toBe('Книга A');
    });

    it('should load config for book B with different defaults and ambients', async () => {
      const config = await loadConfigFromAPI(mockApi, 'book-b');

      expect(config.BOOK_ID).toBe('book-b');
      expect(config.CHAPTERS).toHaveLength(1);
      expect(config.DEFAULT_SETTINGS.font).toBe('inter');
      expect(config.DEFAULT_SETTINGS.fontSize).toBe(20);
      expect(config.DEFAULT_SETTINGS.theme).toBe('dark');
      // Book B has custom ambients
      expect(config.AMBIENT).toHaveProperty('rain');
      expect(config.AMBIENT.rain.label).toBe('Дождь');
    });

    it('should fetch book, settings, and fonts in parallel', async () => {
      await loadConfigFromAPI(mockApi, 'book-a');

      expect(mockApi.getBook).toHaveBeenCalledWith('book-a');
      expect(mockApi.getSettings).toHaveBeenCalled();
      expect(mockApi.getFonts).toHaveBeenCalled();
    });

    it('should gracefully handle settings fetch failure', async () => {
      mockApi.getSettings.mockRejectedValue(new Error('500'));

      const config = await loadConfigFromAPI(mockApi, 'book-a');

      // Defaults used for settings visibility
      expect(config.SETTINGS_VISIBILITY.fontSize).toBe(true);
      expect(config.APPEARANCE.fontMin).toBe(14);
    });

    it('should gracefully handle fonts fetch failure', async () => {
      mockApi.getFonts.mockRejectedValue(new Error('500'));

      const config = await loadConfigFromAPI(mockApi, 'book-a');

      // Default fonts used
      expect(config.FONTS).toHaveProperty('georgia');
    });

    it('should include reading fonts in config', async () => {
      const config = await loadConfigFromAPI(mockApi, 'book-a');

      expect(config.FONTS).toHaveProperty('georgia');
      expect(config.FONTS).toHaveProperty('inter');
      expect(config.FONTS.georgia).toBe('Georgia, serif');
      expect(config.FONTS_LIST).toHaveLength(2);
    });
  });

  // ═══════════════════════════════════════════
  // Config switching with setConfig
  // ═══════════════════════════════════════════

  describe('Config switching with setConfig', () => {
    it('should switch active config between books', async () => {
      const configA = await loadConfigFromAPI(mockApi, 'book-a');
      setConfig(configA);
      expect(getConfig().BOOK_ID).toBe('book-a');

      const configB = await loadConfigFromAPI(mockApi, 'book-b');
      setConfig(configB);
      expect(getConfig().BOOK_ID).toBe('book-b');
      expect(getConfig().DEFAULT_SETTINGS.font).toBe('inter');
    });

    it('should produce different STORAGE_KEYs per book', async () => {
      const configA = await loadConfigFromAPI(mockApi, 'book-a');
      const configB = await loadConfigFromAPI(mockApi, 'book-b');

      expect(configA.STORAGE_KEY).toBe('reader-settings:book-a');
      expect(configB.STORAGE_KEY).toBe('reader-settings:book-b');
      expect(configA.STORAGE_KEY).not.toBe(configB.STORAGE_KEY);
    });
  });

  // ═══════════════════════════════════════════
  // Per-book SettingsManager isolation
  // ═══════════════════════════════════════════

  describe('Per-book SettingsManager isolation', () => {
    it('should maintain separate settings per book via different storage keys', async () => {
      const configA = await loadConfigFromAPI(mockApi, 'book-a');
      const configB = await loadConfigFromAPI(mockApi, 'book-b');

      // Book A: SettingsManager with key reader-settings:book-a
      const storageA = { load: vi.fn(() => ({})), save: vi.fn() };
      const smA = new SettingsManager(storageA, configA.DEFAULT_SETTINGS);
      smA.set('font', 'merriweather');
      smA.set('page', 15);

      // Book B: SettingsManager with key reader-settings:book-b
      const storageB = { load: vi.fn(() => ({})), save: vi.fn() };
      const smB = new SettingsManager(storageB, configB.DEFAULT_SETTINGS);
      smB.set('font', 'roboto');
      smB.set('page', 3);

      // Verify isolation
      expect(smA.get('font')).toBe('merriweather');
      expect(smB.get('font')).toBe('roboto');
      expect(smA.get('page')).toBe(15);
      expect(smB.get('page')).toBe(3);

      // Default settings come from respective configs
      expect(smA.get('fontSize')).toBe(18); // book-a default
      expect(smB.get('fontSize')).toBe(20); // book-b default

      smA.destroy();
      smB.destroy();
    });

    it('should save and restore progress correctly per book', async () => {
      const configA = await loadConfigFromAPI(mockApi, 'book-a');

      // Simulate reading session: save progress
      const savedData = {};
      const storage = {
        load: vi.fn(() => ({ ...savedData })),
        save: vi.fn((d) => Object.assign(savedData, d)),
      };
      const sm = new SettingsManager(storage, configA.DEFAULT_SETTINGS);

      sm.set('page', 42);
      sm.set('font', 'inter');

      // Simulate closing and reopening
      sm.destroy();

      // New session — restore saved state
      const sm2 = new SettingsManager(
        { load: vi.fn(() => ({ ...savedData })), save: vi.fn() },
        configA.DEFAULT_SETTINGS,
      );

      expect(sm2.get('page')).toBe(42);
      expect(sm2.get('font')).toBe('inter');
      sm2.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // Bookshelf → Book select → Config load
  // ═══════════════════════════════════════════

  describe('Bookshelf → select → config load flow', () => {
    it('should render bookshelf, select book, and load its config', async () => {
      const books = await loadBooksFromAPI(mockApi);
      const container = createBookshelfDOM();

      let selectedBookId = null;
      const bookshelf = new BookshelfScreen({
        container,
        books,
        onBookSelect: (bookId) => { selectedBookId = bookId; },
        apiClient: mockApi,
      });
      bookshelf.render();

      // Verify books shown
      const bookCards = container.querySelectorAll('.bookshelf-book-wrapper');
      expect(bookCards).toHaveLength(2);

      // Click on book A → open menu
      const bookBtn = container.querySelector('.bookshelf-book[data-book-id="book-a"]');
      bookBtn.click();

      // Click "Читать" (read action)
      const readBtn = container.querySelector('[data-book-action="read"][data-book-id="book-a"]');
      readBtn.click();

      expect(selectedBookId).toBe('book-a');

      // Load config for selected book
      const config = await loadConfigFromAPI(mockApi, selectedBookId);
      setConfig(config);

      expect(getConfig().BOOK_ID).toBe('book-a');
      expect(getConfig().CHAPTERS).toHaveLength(2);

      bookshelf.destroy();
    });

    it('should switch from book A to book B with full config reload', async () => {
      // Step 1: Load book A config
      const configA = await loadConfigFromAPI(mockApi, 'book-a');
      setConfig(configA);
      expect(getConfig().DEFAULT_SETTINGS.theme).toBe('light');

      // Step 2: "Return to bookshelf" — read book B
      const configB = await loadConfigFromAPI(mockApi, 'book-b');
      setConfig(configB);
      expect(getConfig().DEFAULT_SETTINGS.theme).toBe('dark');
      expect(getConfig().DEFAULT_SETTINGS.font).toBe('inter');

      // Configs are independent frozen objects
      expect(configA.DEFAULT_SETTINGS.theme).toBe('light');
      expect(configB.DEFAULT_SETTINGS.theme).toBe('dark');
    });

    it('should delete a book from bookshelf via API', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);

      const books = await loadBooksFromAPI(mockApi);
      const container = createBookshelfDOM();
      const bookshelf = new BookshelfScreen({
        container,
        books,
        onBookSelect: vi.fn(),
        apiClient: mockApi,
      });
      bookshelf.render();

      expect(container.querySelectorAll('.bookshelf-book-wrapper')).toHaveLength(2);

      // Open book-b menu and delete
      container.querySelector('.bookshelf-book[data-book-id="book-b"]').click();
      container.querySelector('[data-book-action="delete"][data-book-id="book-b"]').click();

      await vi.waitFor(() => {
        expect(mockApi.deleteBook).toHaveBeenCalledWith('book-b');
      });

      // Bookshelf re-rendered with 1 book
      await vi.waitFor(() => {
        expect(container.querySelectorAll('.bookshelf-book-wrapper')).toHaveLength(1);
      });

      bookshelf.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // createConfigFromAPI: edge cases
  // ═══════════════════════════════════════════

  describe('createConfigFromAPI edge cases', () => {
    it('should handle book with no chapters', () => {
      const book = makeBookDetail('empty', 'Empty Book', { chapters: [] });
      const config = createConfigFromAPI(book, globalSettings, readingFonts);

      expect(config.CHAPTERS).toEqual([]);
    });

    it('should handle book with no ambients (use defaults)', () => {
      const book = makeBookDetail('no-amb', 'No Ambients', { ambients: [] });
      const config = createConfigFromAPI(book, globalSettings, readingFonts);

      expect(config.AMBIENT).toHaveProperty('none');
      expect(config.AMBIENT).toHaveProperty('rain');
      expect(config.AMBIENT).toHaveProperty('fireplace');
      expect(config.AMBIENT).toHaveProperty('cafe');
    });

    it('should filter out invisible ambients', () => {
      const book = makeBookDetail('filtered', 'Filtered Ambients', {
        ambients: [
          { id: 'a1', ambientKey: 'rain', label: 'Rain', shortLabel: 'Rain', icon: '🌧️', fileUrl: '/r.mp3', visible: true },
          { id: 'a2', ambientKey: 'hidden', label: 'Hidden', shortLabel: 'H', icon: '?', fileUrl: '/h.mp3', visible: false },
        ],
      });
      const config = createConfigFromAPI(book, globalSettings, readingFonts);

      expect(config.AMBIENT).toHaveProperty('rain');
      expect(config.AMBIENT).not.toHaveProperty('hidden');
    });

    it('should use default fonts when readingFonts is empty', () => {
      const book = makeBookDetail('no-fonts', 'No Fonts');
      const config = createConfigFromAPI(book, globalSettings, []);

      expect(config.FONTS).toHaveProperty('georgia');
      expect(config.FONTS).toHaveProperty('merriweather');
    });

    it('should handle cover bgMode "none"', () => {
      const book = makeBookDetail('no-cover', 'No Cover');
      book.cover = { bg: '', bgMobile: '', bgMode: 'none' };
      const config = createConfigFromAPI(book, globalSettings, readingFonts);

      expect(config.COVER_BG).toBeNull();
      expect(config.COVER_BG_MOBILE).toBeNull();
    });

    it('should handle cover bgMode "custom"', () => {
      const book = makeBookDetail('custom-cover', 'Custom Cover');
      book.cover = { bg: '', bgMobile: '', bgMode: 'custom', bgCustomUrl: 'http://example.com/bg.jpg' };
      const config = createConfigFromAPI(book, globalSettings, readingFonts);

      expect(config.COVER_BG).toBe('http://example.com/bg.jpg');
      expect(config.COVER_BG_MOBILE).toBe('http://example.com/bg.jpg');
    });

    it('should handle decorative font from API', () => {
      const book = makeBookDetail('deco', 'Deco', {
        decorativeFont: { name: 'OldEnglish', fileUrl: 'http://fonts.com/old.woff2' },
      });
      const config = createConfigFromAPI(book, globalSettings, readingFonts);

      expect(config.DECORATIVE_FONT).toEqual({
        name: 'OldEnglish',
        dataUrl: 'http://fonts.com/old.woff2',
      });
    });

    it('should merge globalSettings fontMin/fontMax with appearance', () => {
      const book = makeBookDetail('merge', 'Merge');
      book.appearance = { fontMin: 10, fontMax: 30 };
      const config = createConfigFromAPI(book, { fontMin: 12, fontMax: 28 }, readingFonts);

      // appearance takes priority
      expect(config.APPEARANCE.fontMin).toBe(10);
      expect(config.APPEARANCE.fontMax).toBe(30);
    });

    it('should fall back to globalSettings when appearance has no font limits', () => {
      const book = makeBookDetail('fallback', 'Fallback');
      book.appearance = {};
      const config = createConfigFromAPI(book, { fontMin: 12, fontMax: 28 }, readingFonts);

      expect(config.APPEARANCE.fontMin).toBe(12);
      expect(config.APPEARANCE.fontMax).toBe(28);
    });

    it('should include custom (non-builtin) fonts with fileUrl in CUSTOM_FONTS', () => {
      const customFonts = [
        { id: 'f1', fontKey: 'georgia', label: 'Georgia', family: 'Georgia', builtin: true, enabled: true, fileUrl: null },
        { id: 'f2', fontKey: 'myfont', label: 'My Font', family: 'MyFont', builtin: false, enabled: true, fileUrl: 'http://f.woff2' },
      ];
      const book = makeBookDetail('cf', 'CF');
      const config = createConfigFromAPI(book, globalSettings, customFonts);

      expect(config.CUSTOM_FONTS).toHaveLength(1);
      expect(config.CUSTOM_FONTS[0]).toMatchObject({
        id: 'myfont',
        family: 'MyFont',
        dataUrl: 'http://f.woff2',
      });
    });
  });

  // ═══════════════════════════════════════════
  // Full switching scenario
  // ═══════════════════════════════════════════

  describe('Full book switching scenario', () => {
    it('should switch books preserving independent state', async () => {
      // 1. Load bookshelf
      const books = await loadBooksFromAPI(mockApi);
      expect(books).toHaveLength(2);

      // 2. Select book A and read
      const configA = await loadConfigFromAPI(mockApi, 'book-a');
      setConfig(configA);

      const savedA = {};
      const storageA = {
        load: vi.fn(() => ({ ...savedA })),
        save: vi.fn((d) => Object.assign(savedA, d)),
      };
      const smA = new SettingsManager(storageA, configA.DEFAULT_SETTINGS);
      smA.set('page', 20);
      smA.set('theme', 'dark');
      expect(smA.get('page')).toBe(20);
      smA.destroy();

      // 3. Return to bookshelf, select book B
      const configB = await loadConfigFromAPI(mockApi, 'book-b');
      setConfig(configB);

      const savedB = {};
      const storageB = {
        load: vi.fn(() => ({ ...savedB })),
        save: vi.fn((d) => Object.assign(savedB, d)),
      };
      const smB = new SettingsManager(storageB, configB.DEFAULT_SETTINGS);
      smB.set('page', 5);
      smB.set('theme', 'light');
      expect(smB.get('page')).toBe(5);
      smB.destroy();

      // 4. Return to book A — state preserved
      setConfig(configA);
      const smA2 = new SettingsManager(
        { load: vi.fn(() => ({ ...savedA })), save: vi.fn() },
        configA.DEFAULT_SETTINGS,
      );
      expect(smA2.get('page')).toBe(20);
      expect(smA2.get('theme')).toBe('dark');
      smA2.destroy();

      // 5. Book B state also preserved
      setConfig(configB);
      const smB2 = new SettingsManager(
        { load: vi.fn(() => ({ ...savedB })), save: vi.fn() },
        configB.DEFAULT_SETTINGS,
      );
      expect(smB2.get('page')).toBe(5);
      expect(smB2.get('theme')).toBe('light');
      smB2.destroy();
    });
  });
});
