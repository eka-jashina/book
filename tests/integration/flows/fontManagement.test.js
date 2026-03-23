/**
 * INTEGRATION TEST: Font Management Flow
 * Тестирование потока управления шрифтами:
 * AdminConfigStore CRUD шрифтов → config.buildFontsConfig → SettingsManager применение →
 * FontController переключение шрифтов.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createConfig, createConfigFromAPI } from '../../../js/config.js';
import { SettingsManager } from '../../../js/managers/SettingsManager.js';

// Mock IdbStorage (AdminConfigStore dependency — must use class for `new` compatibility)
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

describe('Font Management Flow Integration', () => {
  const defaultFonts = [
    { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true, dataUrl: null },
    { id: 'merriweather', label: 'Merriweather', family: '"Merriweather", serif', builtin: true, enabled: true, dataUrl: null },
    { id: 'inter', label: 'Inter', family: 'Inter, sans-serif', builtin: true, enabled: true, dataUrl: null },
  ];

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // Font config generation from admin data
  // ═══════════════════════════════════════════

  describe('Font config from admin data', () => {
    it('should use default fonts when no admin config', () => {
      const config = createConfig(null);

      expect(config.FONTS).toHaveProperty('georgia');
      expect(config.FONTS).toHaveProperty('merriweather');
      expect(config.FONTS).toHaveProperty('inter');
    });

    it('should use admin reading fonts when provided', () => {
      const adminConfig = {
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: [
          { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
          { id: 'custom', label: 'My Font', family: '"MyFont", serif', builtin: false, enabled: true, dataUrl: 'data:font/woff2;base64,...' },
        ],
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);

      expect(config.FONTS).toHaveProperty('georgia');
      expect(config.FONTS).toHaveProperty('custom');
      expect(config.FONTS.custom).toBe('"MyFont", serif');
    });

    it('should filter out disabled fonts', () => {
      const adminConfig = {
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: [
          { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
          { id: 'inter', label: 'Inter', family: 'Inter, sans-serif', builtin: true, enabled: false },
        ],
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);

      expect(config.FONTS).toHaveProperty('georgia');
      expect(config.FONTS).not.toHaveProperty('inter');
    });

    it('should populate CUSTOM_FONTS for non-builtin fonts with dataUrl', () => {
      const adminConfig = {
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: [
          { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
          { id: 'custom', label: 'Custom', family: 'CustomFont', builtin: false, enabled: true, dataUrl: 'data:font/woff2;base64,AAA' },
        ],
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);

      expect(config.CUSTOM_FONTS).toHaveLength(1);
      expect(config.CUSTOM_FONTS[0]).toMatchObject({
        id: 'custom',
        family: 'CustomFont',
        dataUrl: 'data:font/woff2;base64,AAA',
      });
    });

    it('should populate FONTS_LIST with metadata', () => {
      const adminConfig = {
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: [
          { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true },
        ],
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);

      expect(config.FONTS_LIST).toHaveLength(1);
      expect(config.FONTS_LIST[0]).toMatchObject({
        id: 'georgia',
        label: 'Georgia',
        family: 'Georgia, serif',
        builtin: true,
      });
    });

    it('should return empty fonts when all readingFonts disabled', () => {
      const adminConfig = {
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: [
          { id: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: false },
        ],
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);

      // When readingFonts array exists but all disabled, no fallback occurs
      expect(Object.keys(config.FONTS).length).toBe(0);
    });

    it('should fallback to defaults when readingFonts array is empty', () => {
      const adminConfig = {
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: [],
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);

      // Empty array triggers fallback to 6 default fonts
      expect(Object.keys(config.FONTS).length).toBe(6);
      expect(config.FONTS).toHaveProperty('georgia');
    });
  });

  // ═══════════════════════════════════════════
  // Font config from API data
  // ═══════════════════════════════════════════

  describe('Font config from API data', () => {
    const bookDetail = {
      id: 'b1', title: 'Book', author: '',
      chapters: [], cover: {}, sounds: {}, ambients: [],
      appearance: {}, defaultSettings: {},
    };

    it('should build FONTS from API reading fonts', () => {
      const readingFonts = [
        { id: 'f1', fontKey: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true, fileUrl: null },
        { id: 'f2', fontKey: 'inter', label: 'Inter', family: 'Inter, sans', builtin: true, enabled: true, fileUrl: null },
      ];

      const config = createConfigFromAPI(bookDetail, null, readingFonts);

      expect(config.FONTS.georgia).toBe('Georgia, serif');
      expect(config.FONTS.inter).toBe('Inter, sans');
    });

    it('should include custom fonts from API with fileUrl', () => {
      const readingFonts = [
        { id: 'f1', fontKey: 'myfont', label: 'MyFont', family: 'MyFont, serif', builtin: false, enabled: true, fileUrl: 'https://fonts.example.com/my.woff2' },
      ];

      const config = createConfigFromAPI(bookDetail, null, readingFonts);

      expect(config.CUSTOM_FONTS).toHaveLength(1);
      expect(config.CUSTOM_FONTS[0].dataUrl).toBe('https://fonts.example.com/my.woff2');
    });

    it('should filter out disabled API fonts', () => {
      const readingFonts = [
        { id: 'f1', fontKey: 'georgia', label: 'Georgia', family: 'Georgia', builtin: true, enabled: true, fileUrl: null },
        { id: 'f2', fontKey: 'disabled', label: 'Off', family: 'Off', builtin: true, enabled: false, fileUrl: null },
      ];

      const config = createConfigFromAPI(bookDetail, null, readingFonts);

      expect(config.FONTS).toHaveProperty('georgia');
      expect(config.FONTS).not.toHaveProperty('disabled');
    });

    it('should use default fonts when API returns empty array', () => {
      const config = createConfigFromAPI(bookDetail, null, []);

      expect(config.FONTS).toHaveProperty('georgia');
      expect(config.FONTS).toHaveProperty('merriweather');
    });
  });

  // ═══════════════════════════════════════════
  // SettingsManager font persistence
  // ═══════════════════════════════════════════

  describe('SettingsManager font persistence', () => {
    it('should persist font selection per book', () => {
      const configA = createConfig(null);
      const savedA = {};
      const storageA = {
        load: vi.fn(() => ({ ...savedA })),
        save: vi.fn((d) => Object.assign(savedA, d)),
      };
      const smA = new SettingsManager(storageA, configA.DEFAULT_SETTINGS);

      smA.set('font', 'inter');
      expect(smA.get('font')).toBe('inter');

      smA.destroy();

      // Re-create — restores saved font
      const smA2 = new SettingsManager(
        { load: vi.fn(() => ({ ...savedA })), save: vi.fn() },
        configA.DEFAULT_SETTINGS,
      );
      expect(smA2.get('font')).toBe('inter');
      smA2.destroy();
    });

    it('should use config default font for new books', () => {
      const adminConfig = {
        books: [{
          id: 'b1', cover: { title: 'T' }, chapters: [],
          defaultSettings: { font: 'inter', fontSize: 20 },
        }],
        activeBookId: 'b1',
        readingFonts: defaultFonts,
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);
      expect(config.DEFAULT_SETTINGS.font).toBe('inter');

      const sm = new SettingsManager(
        { load: vi.fn(() => ({})), save: vi.fn() },
        config.DEFAULT_SETTINGS,
      );

      // Default from config
      expect(sm.get('font')).toBe('inter');
      sm.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // Font add / toggle / remove flow
  // ═══════════════════════════════════════════

  describe('Font CRUD → config rebuild flow', () => {
    it('should add custom font and see it in rebuilt config', () => {
      const fonts = [...defaultFonts];

      // Simulate: user adds custom font via FontsModule
      fonts.push({
        id: 'custom-serif',
        label: 'My Serif',
        family: '"MySerif", serif',
        builtin: false,
        enabled: true,
        dataUrl: 'data:font/woff2;base64,ABCD',
      });

      const adminConfig = {
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: fonts,
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);

      expect(config.FONTS['custom-serif']).toBe('"MySerif", serif');
      expect(config.CUSTOM_FONTS.find(f => f.id === 'custom-serif')).toBeTruthy();
    });

    it('should toggle font off and rebuild config without it', () => {
      const fonts = defaultFonts.map(f =>
        f.id === 'inter' ? { ...f, enabled: false } : f,
      );

      const adminConfig = {
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: fonts,
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);

      expect(config.FONTS).toHaveProperty('georgia');
      expect(config.FONTS).not.toHaveProperty('inter');
    });

    it('should remove font and switch reader to another if it was selected', () => {
      // Initial config with 3 fonts, user selected inter
      const config1 = createConfig({
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: defaultFonts,
        settingsVisibility: {},
      });

      const saved = { font: 'inter' };
      const storage = {
        load: vi.fn(() => ({ ...saved })),
        save: vi.fn((d) => Object.assign(saved, d)),
      };
      const sm = new SettingsManager(storage, config1.DEFAULT_SETTINGS);
      expect(sm.get('font')).toBe('inter');

      // Admin removes inter
      const fontsWithoutInter = defaultFonts.filter(f => f.id !== 'inter');
      const config2 = createConfig({
        books: [{ id: 'b1', cover: { title: 'T' }, chapters: [] }],
        activeBookId: 'b1',
        readingFonts: fontsWithoutInter,
        settingsVisibility: {},
      });

      // Inter no longer in FONTS — user's selection is orphaned
      expect(config2.FONTS).not.toHaveProperty('inter');

      // In real app, FontController would detect this and switch to first available
      const availableFonts = Object.keys(config2.FONTS);
      const currentFont = sm.get('font');
      if (!config2.FONTS[currentFont]) {
        sm.set('font', availableFonts[0]);
      }

      expect(sm.get('font')).toBe(availableFonts[0]);
      sm.destroy();
    });
  });

  // ═══════════════════════════════════════════
  // Decorative font
  // ═══════════════════════════════════════════

  describe('Decorative font integration', () => {
    it('should include decorative font in config', () => {
      const adminConfig = {
        books: [{
          id: 'b1', cover: { title: 'T' }, chapters: [],
          decorativeFont: { name: 'OldEnglish', dataUrl: 'data:font/woff2;base64,...' },
        }],
        activeBookId: 'b1',
        readingFonts: defaultFonts,
        settingsVisibility: {},
      };

      const config = createConfig(adminConfig);

      expect(config.DECORATIVE_FONT).toEqual({
        name: 'OldEnglish',
        dataUrl: 'data:font/woff2;base64,...',
      });
    });

    it('should handle null decorative font', () => {
      const config = createConfig(null);
      expect(config.DECORATIVE_FONT).toBeNull();
    });

    it('should include decorative font from API', () => {
      const bookDetail = {
        id: 'b1', title: 'Test', author: '',
        chapters: [], cover: {}, sounds: {}, ambients: [],
        appearance: {}, defaultSettings: {},
        decorativeFont: { name: 'Fancy', fileUrl: 'https://fonts.com/fancy.woff2' },
      };

      const config = createConfigFromAPI(bookDetail, null, []);

      expect(config.DECORATIVE_FONT).toEqual({
        name: 'Fancy',
        dataUrl: 'https://fonts.com/fancy.woff2',
      });
    });
  });
});
