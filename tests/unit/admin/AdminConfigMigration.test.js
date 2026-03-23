/**
 * Тесты для AdminConfigMigration
 * Валидация, миграция и нормализация конфигурации
 */
import { describe, it, expect, vi } from 'vitest';

import {
  validateSchema,
  migrateBooks,
  extractTopLevelFallback,
  migrateSchema,
  ensureBookSettings,
  mergeWithDefaults,
} from '../../../js/admin/AdminConfigMigration.js';

import {
  DEFAULT_CONFIG,
  CONFIG_SCHEMA_VERSION,
  DEFAULT_BOOK_SETTINGS,
  LIGHT_DEFAULTS,
  DARK_DEFAULTS,
} from '../../../js/admin/AdminConfigDefaults.js';

describe('AdminConfigMigration', () => {
  describe('validateSchema', () => {
    it('should return empty array for valid config', () => {
      const errors = validateSchema(structuredClone(DEFAULT_CONFIG));
      expect(errors).toEqual([]);
    });

    it('should reject non-object config', () => {
      expect(validateSchema(null)).toContain('Конфигурация должна быть объектом');
      expect(validateSchema('string')).toContain('Конфигурация должна быть объектом');
    });

    it('should require books to be array', () => {
      const config = { ...structuredClone(DEFAULT_CONFIG), books: 'not-array' };
      const errors = validateSchema(config);
      expect(errors).toContain('books должен быть массивом');
    });

    it('should validate each book has id, cover, chapters', () => {
      const config = structuredClone(DEFAULT_CONFIG);
      config.books = [{ }];
      const errors = validateSchema(config);
      expect(errors).toContain('books[0]: отсутствует id');
      expect(errors).toContain('books[0]: отсутствует cover');
      expect(errors).toContain('books[0]: chapters должен быть массивом');
    });

    it('should require activeBookId to be string', () => {
      const config = { ...structuredClone(DEFAULT_CONFIG), activeBookId: 123 };
      const errors = validateSchema(config);
      expect(errors).toContain('activeBookId должен быть строкой');
    });

    it('should require fontMin and fontMax to be finite numbers', () => {
      const config = { ...structuredClone(DEFAULT_CONFIG), fontMin: 'abc', fontMax: Infinity };
      const errors = validateSchema(config);
      expect(errors).toContain('fontMin должен быть конечным числом');
      expect(errors).toContain('fontMax должен быть конечным числом');
    });

    it('should require readingFonts to be array', () => {
      const config = { ...structuredClone(DEFAULT_CONFIG), readingFonts: {} };
      const errors = validateSchema(config);
      expect(errors).toContain('readingFonts должен быть массивом');
    });

    it('should require settingsVisibility to be object', () => {
      const config = { ...structuredClone(DEFAULT_CONFIG), settingsVisibility: null };
      const errors = validateSchema(config);
      expect(errors).toContain('settingsVisibility должен быть объектом');
    });
  });

  describe('migrateBooks', () => {
    it('should return existing books if present', () => {
      const books = [{ id: 'b1', cover: {}, chapters: [] }];
      expect(migrateBooks({ books })).toBe(books);
    });

    it('should migrate from old top-level cover/chapters format', () => {
      const saved = {
        cover: { title: 'Old Book' },
        chapters: [{ id: 'ch1' }],
      };
      const result = migrateBooks(saved);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('default');
      expect(result[0].cover.title).toBe('Old Book');
      expect(result[0].chapters).toHaveLength(1);
    });

    it('should return default books if no data', () => {
      const result = migrateBooks({});
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('default');
    });

    it('should return default books for empty books array', () => {
      const result = migrateBooks({ books: [] });
      expect(result).toHaveLength(1);
    });
  });

  describe('extractTopLevelFallback', () => {
    it('should extract per-book fields from top level', () => {
      const saved = {
        defaultSettings: { font: 'inter' },
        sounds: { pageFlip: 'test.mp3' },
        appearance: { light: {} },
        ambients: [{ id: 'rain' }],
        decorativeFont: { name: 'Custom' },
      };
      const result = extractTopLevelFallback(saved);
      expect(result.defaultSettings).toEqual({ font: 'inter' });
      expect(result.sounds).toEqual({ pageFlip: 'test.mp3' });
      expect(result.ambients).toHaveLength(1);
      expect(result.decorativeFont).toEqual({ name: 'Custom' });
    });

    it('should return nulls for missing fields', () => {
      const result = extractTopLevelFallback({});
      expect(result.defaultSettings).toBeNull();
      expect(result.sounds).toBeNull();
      expect(result.appearance).toBeNull();
      expect(result.ambients).toBeNull();
    });
  });

  describe('migrateSchema', () => {
    it('should return data unchanged for current version', () => {
      const data = { _schemaVersion: CONFIG_SCHEMA_VERSION, books: [] };
      const result = migrateSchema(data, CONFIG_SCHEMA_VERSION);
      expect(result).toBe(data);
    });

    it('should log migration for old versions', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      migrateSchema({}, 1);
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('ensureBookSettings', () => {
    it('should add missing defaultSettings from fallback', () => {
      const book = { id: 'b1' };
      ensureBookSettings(book, { defaultSettings: { font: 'inter' } });
      expect(book.defaultSettings.font).toBe('inter');
      expect(book.defaultSettings.fontSize).toBe(DEFAULT_BOOK_SETTINGS.defaultSettings.fontSize);
    });

    it('should not overwrite existing defaultSettings', () => {
      const book = { id: 'b1', defaultSettings: { font: 'custom' } };
      ensureBookSettings(book, {});
      expect(book.defaultSettings.font).toBe('custom');
    });

    it('should add appearance with light/dark from per-theme fallback', () => {
      const book = { id: 'b1' };
      ensureBookSettings(book, {
        appearance: { light: { coverBgStart: '#fff' }, dark: { coverBgStart: '#000' } },
      });
      expect(book.appearance.light.coverBgStart).toBe('#fff');
      expect(book.appearance.dark.coverBgStart).toBe('#000');
    });

    it('should add appearance from flat fallback (legacy)', () => {
      const book = { id: 'b1' };
      ensureBookSettings(book, {
        appearance: { coverBgStart: '#abc' },
      });
      expect(book.appearance.light.coverBgStart).toBe('#abc');
      expect(book.appearance.dark.coverBgStart).toBe(DARK_DEFAULTS.coverBgStart);
    });

    it('should merge existing appearance with defaults', () => {
      const book = {
        id: 'b1',
        appearance: { light: { coverBgStart: '#custom' } },
      };
      ensureBookSettings(book, {});
      expect(book.appearance.light.coverBgStart).toBe('#custom');
      expect(book.appearance.light.bgPage).toBe(LIGHT_DEFAULTS.bgPage);
      expect(book.appearance.dark.coverBgStart).toBe(DARK_DEFAULTS.coverBgStart);
    });

    it('should add sounds from fallback', () => {
      const book = { id: 'b1' };
      ensureBookSettings(book, { sounds: { pageFlip: 'custom.mp3' } });
      expect(book.sounds.pageFlip).toBe('custom.mp3');
    });

    it('should add ambients from fallback or defaults', () => {
      const book = { id: 'b1' };
      ensureBookSettings(book, {});
      expect(book.ambients).toHaveLength(4);
    });

    it('should handle decorativeFont from fallback', () => {
      const book = { id: 'b1' };
      ensureBookSettings(book, { decorativeFont: { name: 'Fancy' } });
      expect(book.decorativeFont.name).toBe('Fancy');
    });

    it('should set decorativeFont to null when undefined in both', () => {
      const book = { id: 'b1' };
      ensureBookSettings(book, {});
      expect(book.decorativeFont).toBeNull();
    });
  });

  describe('mergeWithDefaults', () => {
    it('should produce valid config from empty input', () => {
      const result = mergeWithDefaults({});
      const errors = validateSchema(result);
      expect(errors).toEqual([]);
    });

    it('should set current schema version', () => {
      const result = mergeWithDefaults({});
      expect(result._schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    });

    it('should preserve existing data', () => {
      const saved = structuredClone(DEFAULT_CONFIG);
      saved.fontMin = 10;
      saved.fontMax = 30;
      const result = mergeWithDefaults(saved);
      expect(result.fontMin).toBe(10);
      expect(result.fontMax).toBe(30);
    });

    it('should migrate fontMin/fontMax from appearance (old format)', () => {
      const result = mergeWithDefaults({
        appearance: { fontMin: 12, fontMax: 24 },
      });
      expect(result.fontMin).toBe(12);
      expect(result.fontMax).toBe(24);
    });

    it('should use default readingFonts if not array', () => {
      const result = mergeWithDefaults({ readingFonts: 'invalid' });
      expect(result.readingFonts).toHaveLength(6);
    });

    it('should merge settingsVisibility with defaults', () => {
      const result = mergeWithDefaults({
        settingsVisibility: { fontSize: false },
      });
      expect(result.settingsVisibility.fontSize).toBe(false);
      expect(result.settingsVisibility.theme).toBe(true);
    });

    it('should use first book id as activeBookId if not set', () => {
      const result = mergeWithDefaults({
        books: [{ id: 'my-book', cover: {}, chapters: [] }],
      });
      expect(result.activeBookId).toBe('my-book');
    });
  });
});
