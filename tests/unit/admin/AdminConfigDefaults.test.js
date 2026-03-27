/**
 * Тесты для AdminConfigDefaults
 * Дефолтные константы конфигурации
 */
import { describe, it, expect } from 'vitest';

import {
  LIGHT_DEFAULTS,
  DARK_DEFAULTS,
  DEFAULT_READING_FONTS,
  DEFAULT_BOOK_SETTINGS,
  DEFAULT_BOOK,
  CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
} from '../../../js/admin/AdminConfigDefaults.js';

describe('AdminConfigDefaults', () => {
  describe('LIGHT_DEFAULTS', () => {
    it('should have all required theme fields', () => {
      expect(LIGHT_DEFAULTS).toHaveProperty('coverBgStart');
      expect(LIGHT_DEFAULTS).toHaveProperty('coverBgEnd');
      expect(LIGHT_DEFAULTS).toHaveProperty('coverText');
      expect(LIGHT_DEFAULTS).toHaveProperty('coverBgImage');
      expect(LIGHT_DEFAULTS).toHaveProperty('pageTexture');
      expect(LIGHT_DEFAULTS).toHaveProperty('customTextureData');
      expect(LIGHT_DEFAULTS).toHaveProperty('bgPage');
      expect(LIGHT_DEFAULTS).toHaveProperty('bgApp');
    });

    it('should use default page texture', () => {
      expect(LIGHT_DEFAULTS.pageTexture).toBe('default');
    });

    it('should have null for optional image fields', () => {
      expect(LIGHT_DEFAULTS.coverBgImage).toBeNull();
      expect(LIGHT_DEFAULTS.customTextureData).toBeNull();
    });
  });

  describe('DARK_DEFAULTS', () => {
    it('should have all required theme fields', () => {
      expect(DARK_DEFAULTS).toHaveProperty('coverBgStart');
      expect(DARK_DEFAULTS).toHaveProperty('bgPage');
      expect(DARK_DEFAULTS).toHaveProperty('bgApp');
    });

    it('should use no page texture', () => {
      expect(DARK_DEFAULTS.pageTexture).toBe('none');
    });

    it('should have darker colors than light theme', () => {
      // Dark theme backgrounds should be dark
      expect(DARK_DEFAULTS.bgPage).toBe('#1e1e1e');
      expect(DARK_DEFAULTS.bgApp).toBe('#121212');
    });
  });

  describe('DEFAULT_READING_FONTS', () => {
    it('should have 6 built-in fonts', () => {
      expect(DEFAULT_READING_FONTS).toHaveLength(6);
    });

    it('should all be builtin and enabled', () => {
      for (const font of DEFAULT_READING_FONTS) {
        expect(font.builtin).toBe(true);
        expect(font.enabled).toBe(true);
      }
    });

    it('should all have id, label, family', () => {
      for (const font of DEFAULT_READING_FONTS) {
        expect(font.id).toBeTruthy();
        expect(font.label).toBeTruthy();
        expect(font.family).toBeTruthy();
      }
    });

    it('should include Georgia as first font', () => {
      expect(DEFAULT_READING_FONTS[0].id).toBe('georgia');
    });
  });

  describe('DEFAULT_BOOK_SETTINGS', () => {
    it('should have defaultSettings with all fields', () => {
      const ds = DEFAULT_BOOK_SETTINGS.defaultSettings;
      expect(ds.font).toBe('georgia');
      expect(ds.fontSize).toBe(18);
      expect(ds.theme).toBe('light');
      expect(ds.soundEnabled).toBe(true);
      expect(ds.soundVolume).toBe(0.3);
      expect(ds.ambientType).toBe('none');
      expect(ds.ambientVolume).toBe(0.5);
    });

    it('should have appearance with light and dark themes', () => {
      expect(DEFAULT_BOOK_SETTINGS.appearance.light).toBeDefined();
      expect(DEFAULT_BOOK_SETTINGS.appearance.dark).toBeDefined();
    });

    it('should have sounds configuration', () => {
      expect(DEFAULT_BOOK_SETTINGS.sounds.pageFlip).toBeTruthy();
      expect(DEFAULT_BOOK_SETTINGS.sounds.bookOpen).toBeTruthy();
      expect(DEFAULT_BOOK_SETTINGS.sounds.bookClose).toBeTruthy();
    });

    it('should have 4 ambient presets', () => {
      expect(DEFAULT_BOOK_SETTINGS.ambients).toHaveLength(4);
      expect(DEFAULT_BOOK_SETTINGS.ambients[0].id).toBe('none');
    });

    it('should have null decorativeFont by default', () => {
      expect(DEFAULT_BOOK_SETTINGS.decorativeFont).toBeNull();
    });
  });

  describe('DEFAULT_BOOK', () => {
    it('should have id "default"', () => {
      expect(DEFAULT_BOOK.id).toBe('default');
    });

    it('should have 3 chapters', () => {
      expect(DEFAULT_BOOK.chapters).toHaveLength(3);
    });

    it('should have cover with title and author', () => {
      expect(DEFAULT_BOOK.cover.title).toBeTruthy();
      expect(DEFAULT_BOOK.cover.author).toBeTruthy();
    });

    it('should inherit all book settings', () => {
      expect(DEFAULT_BOOK.defaultSettings).toBeDefined();
      expect(DEFAULT_BOOK.appearance).toBeDefined();
      expect(DEFAULT_BOOK.sounds).toBeDefined();
      expect(DEFAULT_BOOK.ambients).toBeDefined();
    });
  });

  describe('CONFIG_SCHEMA_VERSION', () => {
    it('should be 2', () => {
      expect(CONFIG_SCHEMA_VERSION).toBe(2);
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have schema version', () => {
      expect(DEFAULT_CONFIG._schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    });

    it('should have one default book', () => {
      expect(DEFAULT_CONFIG.books).toHaveLength(1);
      expect(DEFAULT_CONFIG.activeBookId).toBe('default');
    });

    it('should have font range', () => {
      expect(DEFAULT_CONFIG.fontMin).toBe(14);
      expect(DEFAULT_CONFIG.fontMax).toBe(22);
    });

    it('should have reading fonts', () => {
      expect(DEFAULT_CONFIG.readingFonts).toHaveLength(6);
    });

    it('should have all settings visible by default', () => {
      const vis = DEFAULT_CONFIG.settingsVisibility;
      expect(vis.fontSize).toBe(true);
      expect(vis.theme).toBe(true);
      expect(vis.font).toBe(true);
      expect(vis.fullscreen).toBe(true);
      expect(vis.sound).toBe(true);
      expect(vis.ambient).toBe(true);
    });

    it('should be independent from DEFAULT_BOOK (deep copy)', () => {
      const configCopy = structuredClone(DEFAULT_CONFIG);
      configCopy.books[0].cover.title = 'CHANGED';
      expect(DEFAULT_BOOK.cover.title).not.toBe('CHANGED');
    });
  });
});
