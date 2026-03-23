/**
 * INTEGRATION TEST: Config Export/Import Roundtrip
 * Тестирование полного цикла: AdminConfigStore CRUD → exportJSON →
 * модификация → importJSON → валидация → проверка целостности данных.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminConfigStore } from '../../../js/admin/AdminConfigStore.js';
import {
  DEFAULT_CONFIG,
  CONFIG_SCHEMA_VERSION,
  LIGHT_DEFAULTS,
  DARK_DEFAULTS,
  DEFAULT_READING_FONTS,
} from '../../../js/admin/AdminConfigDefaults.js';

// Mock IdbStorage to avoid real IndexedDB (must use class for `new` compatibility)
vi.mock('../../../js/utils/IdbStorage.js', () => ({
  IdbStorage: class MockIdbStorage {
    constructor() {
      this.get = vi.fn().mockResolvedValue(null);
      this.put = vi.fn().mockResolvedValue();
      this.delete = vi.fn().mockResolvedValue();
      this.destroy = vi.fn();
    }
  },
}));

describe('Config Export/Import Roundtrip Integration', () => {
  /** @type {AdminConfigStore} */
  let store;

  beforeEach(async () => {
    localStorage.clear();
    store = await AdminConfigStore.create();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // Basic roundtrip
  // ═══════════════════════════════════════════

  describe('Basic export/import roundtrip', () => {
    it('should export and re-import default config without data loss', () => {
      const exported = store.exportJSON();
      const parsed = JSON.parse(exported);

      expect(parsed._schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
      expect(parsed.books).toBeDefined();
      expect(parsed.readingFonts).toBeDefined();

      // Re-import
      store.importJSON(exported);

      const reExported = store.exportJSON();
      expect(JSON.parse(reExported)._schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    });

    it('should preserve books through roundtrip', () => {
      // Add a book
      store.addBook({
        cover: { title: 'My Novel', author: 'Author' },
        chapters: [
          { id: 'ch1', title: 'Chapter 1', file: '', htmlContent: '<p>Text</p>', bg: '', bgMobile: '' },
        ],
      });

      const exported = store.exportJSON();
      const parsed = JSON.parse(exported);

      expect(parsed.books.length).toBeGreaterThanOrEqual(2); // default + new

      // Reset and re-import
      store.reset();
      expect(store.getBooks().length).toBe(1); // only default after reset

      store.importJSON(exported);

      const books = store.getBooks();
      const novel = books.find(b => b.title === 'My Novel');
      expect(novel).toBeDefined();
      expect(novel.chaptersCount).toBe(1);

      // Verify chapter details via active book
      store.setActiveBook(novel.id);
      const chapters = store.getChapters();
      expect(chapters[0].title).toBe('Chapter 1');
    });

    it('should preserve reading fonts through roundtrip', () => {
      store.addReadingFont({
        id: 'custom-font',
        label: 'Custom',
        family: '"CustomFont", serif',
        builtin: false,
        enabled: true,
        dataUrl: 'data:font/woff2;base64,ABC',
      });

      const exported = store.exportJSON();
      store.reset();
      store.importJSON(exported);

      const fonts = store.getReadingFonts();
      const custom = fonts.find(f => f.id === 'custom-font');
      expect(custom).toBeDefined();
      expect(custom.family).toBe('"CustomFont", serif');
      expect(custom.dataUrl).toBe('data:font/woff2;base64,ABC');
    });

    it('should preserve settings visibility through roundtrip', () => {
      store.updateSettingsVisibility({
        fontSize: false,
        ambient: false,
      });

      const exported = store.exportJSON();
      store.reset();
      store.importJSON(exported);

      const vis = store.getSettingsVisibility();
      expect(vis.fontSize).toBe(false);
      expect(vis.ambient).toBe(false);
      expect(vis.theme).toBe(true); // unchanged
    });
  });

  // ═══════════════════════════════════════════
  // Modify exported data
  // ═══════════════════════════════════════════

  describe('Modify exported data before import', () => {
    it('should allow modifying book titles in export', () => {
      const exported = JSON.parse(store.exportJSON());
      exported.books[0].cover.title = 'Modified Title';

      store.importJSON(JSON.stringify(exported));

      const books = store.getBooks();
      expect(books[0].title).toBe('Modified Title');
    });

    it('should allow adding new chapters in export', () => {
      const exported = JSON.parse(store.exportJSON());
      exported.books[0].chapters.push({
        id: 'new-ch',
        title: 'New Chapter',
        file: '',
        htmlContent: '<p>New content</p>',
        bg: '',
        bgMobile: '',
      });

      store.importJSON(JSON.stringify(exported));

      const chapters = store.getChapters();
      expect(chapters.find(ch => ch.title === 'New Chapter')).toBeDefined();
    });

    it('should allow modifying font limits', () => {
      const exported = JSON.parse(store.exportJSON());
      exported.fontMin = 10;
      exported.fontMax = 30;

      store.importJSON(JSON.stringify(exported));

      const reExported = JSON.parse(store.exportJSON());
      expect(reExported.fontMin).toBe(10);
      expect(reExported.fontMax).toBe(30);
    });

    it('should allow adding a new book in export', () => {
      const exported = JSON.parse(store.exportJSON());
      exported.books.push({
        id: 'new-book',
        cover: { title: 'Added Book', author: 'New Author', bg: '', bgMobile: '', bgMode: 'default', bgCustomData: null },
        chapters: [],
      });

      store.importJSON(JSON.stringify(exported));

      const books = store.getBooks();
      expect(books.find(b => b.id === 'new-book')).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // Schema validation and defaults filling
  // ═══════════════════════════════════════════

  describe('Schema validation on import', () => {
    it('should fill missing per-book settings with defaults', () => {
      const minimalConfig = {
        books: [{
          id: 'bare',
          cover: { title: 'Bare Book', author: '' },
          chapters: [],
          // No defaultSettings, appearance, sounds, ambients, decorativeFont
        }],
        activeBookId: 'bare',
        readingFonts: [],
        settingsVisibility: {},
        fontMin: 14,
        fontMax: 22,
      };

      store.importJSON(JSON.stringify(minimalConfig));

      const exported = JSON.parse(store.exportJSON());
      const book = exported.books.find(b => b.id === 'bare');

      // All per-book settings filled with defaults
      expect(book.defaultSettings).toBeDefined();
      expect(book.defaultSettings.font).toBe('georgia');
      expect(book.appearance).toBeDefined();
      expect(book.appearance.light).toBeDefined();
      expect(book.appearance.dark).toBeDefined();
      expect(book.sounds).toBeDefined();
      expect(book.ambients).toBeDefined();
    });

    it('should fill appearance with theme defaults', () => {
      const config = {
        books: [{
          id: 'b1',
          cover: { title: 'T', author: '' },
          chapters: [],
        }],
        activeBookId: 'b1',
        readingFonts: [],
        settingsVisibility: {},
        fontMin: 14,
        fontMax: 22,
      };

      store.importJSON(JSON.stringify(config));

      const exported = JSON.parse(store.exportJSON());
      const book = exported.books.find(b => b.id === 'b1');

      expect(book.appearance.light.coverBgStart).toBe(LIGHT_DEFAULTS.coverBgStart);
      expect(book.appearance.dark.coverBgStart).toBe(DARK_DEFAULTS.coverBgStart);
    });

    it('should update schema version on import', () => {
      const oldConfig = {
        _schemaVersion: 1,
        books: [{
          id: 'b1',
          cover: { title: 'T', author: '' },
          chapters: [],
        }],
        activeBookId: 'b1',
        readingFonts: [],
        settingsVisibility: {},
        fontMin: 14,
        fontMax: 22,
      };

      store.importJSON(JSON.stringify(oldConfig));

      const exported = JSON.parse(store.exportJSON());
      expect(exported._schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    });

    it('should reject invalid JSON on import', () => {
      expect(() => store.importJSON('not-valid-json')).toThrow();
    });

    it('should handle empty books array gracefully', () => {
      const config = {
        books: [],
        activeBookId: '',
        readingFonts: [],
        settingsVisibility: {},
        fontMin: 14,
        fontMax: 22,
      };

      store.importJSON(JSON.stringify(config));

      const exported = JSON.parse(store.exportJSON());
      // _mergeWithDefaults may add default book or keep empty
      expect(exported.books).toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // Per-book settings preservation
  // ═══════════════════════════════════════════

  describe('Per-book settings preservation', () => {
    it('should preserve sounds through roundtrip', () => {
      store.updateSounds({
        pageFlip: '/custom-flip.mp3',
        bookOpen: '/custom-open.mp3',
        bookClose: '/custom-close.mp3',
      });

      const exported = store.exportJSON();
      store.reset();
      store.importJSON(exported);

      const sounds = store.getSounds();
      expect(sounds.pageFlip).toBe('/custom-flip.mp3');
      expect(sounds.bookOpen).toBe('/custom-open.mp3');
    });

    it('should preserve ambients through roundtrip', () => {
      store.addAmbient({
        id: 'custom-ambient',
        label: 'Forest',
        shortLabel: 'Forest',
        icon: '🌲',
        file: '/sounds/forest.mp3',
        visible: true,
        builtin: false,
      });

      const exported = store.exportJSON();
      store.reset();
      store.importJSON(exported);

      const ambients = store.getAmbients();
      const forest = ambients.find(a => a.id === 'custom-ambient');
      expect(forest).toBeDefined();
      expect(forest.label).toBe('Forest');
      expect(forest.file).toBe('/sounds/forest.mp3');
    });

    it('should preserve default settings through roundtrip', () => {
      store.updateDefaultSettings({
        font: 'inter',
        fontSize: 20,
        theme: 'dark',
        soundEnabled: false,
      });

      const exported = store.exportJSON();
      store.reset();
      store.importJSON(exported);

      const settings = store.getDefaultSettings();
      expect(settings.font).toBe('inter');
      expect(settings.fontSize).toBe(20);
      expect(settings.theme).toBe('dark');
    });

    it('should preserve appearance themes through roundtrip', () => {
      store.updateAppearanceTheme('light', {
        coverBgStart: '#112233',
        bgPage: '#fafafa',
      });
      store.updateAppearanceTheme('dark', {
        coverBgStart: '#001122',
        bgApp: '#0a0a0a',
      });

      const exported = store.exportJSON();
      store.reset();
      store.importJSON(exported);

      const appearance = store.getAppearance();
      expect(appearance.light.coverBgStart).toBe('#112233');
      expect(appearance.light.bgPage).toBe('#fafafa');
      expect(appearance.dark.coverBgStart).toBe('#001122');
      expect(appearance.dark.bgApp).toBe('#0a0a0a');
    });

    it('should preserve decorative font through roundtrip', () => {
      store.setDecorativeFont({
        name: 'OldEnglish',
        dataUrl: 'data:font/woff2;base64,FONTDATA',
      });

      const exported = store.exportJSON();
      store.reset();
      store.importJSON(exported);

      const font = store.getDecorativeFont();
      expect(font.name).toBe('OldEnglish');
      expect(font.dataUrl).toBe('data:font/woff2;base64,FONTDATA');
    });
  });

  // ═══════════════════════════════════════════
  // Multi-book export/import
  // ═══════════════════════════════════════════

  describe('Multi-book export/import', () => {
    it('should preserve multiple books with independent settings', () => {
      // Add second book
      store.addBook({
        cover: { title: 'Second Book', author: 'Author 2' },
        chapters: [],
      });

      const books = store.getBooks();
      expect(books).toHaveLength(2);

      // Customize second book
      store.setActiveBook(books[1].id);
      store.updateSounds({ pageFlip: '/book2-flip.mp3' });

      const exported = store.exportJSON();
      store.reset();
      store.importJSON(exported);

      const reimportedBooks = store.getBooks();
      expect(reimportedBooks).toHaveLength(2);

      // Switch to second book and verify
      store.setActiveBook(reimportedBooks[1].id);
      const sounds = store.getSounds();
      expect(sounds.pageFlip).toBe('/book2-flip.mp3');
    });

    it('should preserve activeBookId through roundtrip', () => {
      store.addBook({
        cover: { title: 'Book 2', author: '' },
        chapters: [],
      });

      const books = store.getBooks();
      store.setActiveBook(books[1].id);

      const exported = store.exportJSON();
      const parsed = JSON.parse(exported);

      expect(parsed.activeBookId).toBe(books[1].id);

      store.reset();
      store.importJSON(exported);

      expect(store.getActiveBookId()).toBe(books[1].id);
    });
  });

  // ═══════════════════════════════════════════
  // Full lifecycle scenario
  // ═══════════════════════════════════════════

  describe('Full lifecycle: create → customize → export → import on new device', () => {
    it('should recreate complete book setup from export', () => {
      // 1. Create and customize book
      store.addBook({
        cover: { title: 'Complete Novel', author: 'Great Author' },
        chapters: [
          { id: 'ch1', title: 'Prologue', file: '', htmlContent: '<p>It begins...</p>', bg: '', bgMobile: '' },
          { id: 'ch2', title: 'Chapter 1', file: '', htmlContent: '<p>Once upon a time</p>', bg: '', bgMobile: '' },
        ],
      });

      const books = store.getBooks();
      const novelId = books.find(b => b.title === 'Complete Novel').id;
      store.setActiveBook(novelId);

      // 2. Customize
      store.updateSounds({ pageFlip: '/sounds/custom.mp3' });
      store.updateDefaultSettings({ font: 'merriweather', fontSize: 22, theme: 'dark' });
      store.updateAppearanceTheme('light', { coverBgStart: '#1a5276', coverBgEnd: '#154360' });
      store.setDecorativeFont({ name: 'Vintage', dataUrl: 'data:font/...' });
      store.addAmbient({
        id: 'ocean', label: 'Ocean', shortLabel: 'Sea',
        icon: '🌊', file: '/sounds/ocean.mp3', visible: true, builtin: false,
      });
      store.addReadingFont({
        id: 'garamond', label: 'Garamond', family: '"EB Garamond", serif',
        builtin: false, enabled: true, dataUrl: 'data:font/woff2;base64,GAR',
      });
      store.updateSettingsVisibility({ fullscreen: false });

      // 3. Export
      const exported = store.exportJSON();
      const parsed = JSON.parse(exported);

      // 4. Simulate "new device" — reset and import
      store.reset();
      store.importJSON(exported);

      // 5. Verify everything restored
      const importedBooks = store.getBooks();
      const novel = importedBooks.find(b => b.title === 'Complete Novel');
      expect(novel).toBeDefined();
      expect(novel.chaptersCount).toBe(2);

      store.setActiveBook(novel.id);

      // Verify chapter content via active book
      const chapters = store.getChapters();
      expect(chapters[0].htmlContent).toBe('<p>It begins...</p>');

      expect(store.getSounds().pageFlip).toBe('/sounds/custom.mp3');
      expect(store.getDefaultSettings().font).toBe('merriweather');
      expect(store.getDefaultSettings().fontSize).toBe(22);

      const appearance = store.getAppearance();
      expect(appearance.light.coverBgStart).toBe('#1a5276');

      const deco = store.getDecorativeFont();
      expect(deco.name).toBe('Vintage');

      const ambients = store.getAmbients();
      expect(ambients.find(a => a.id === 'ocean')).toBeDefined();

      const fonts = store.getReadingFonts();
      expect(fonts.find(f => f.id === 'garamond')).toBeDefined();

      expect(store.getSettingsVisibility().fullscreen).toBe(false);
    });
  });
});
