/**
 * TESTS: AdminConfigStore — Advanced
 * Тесты для расширенных сценариев: IDB ошибки, оптимистичная блокировка,
 * _saveToLocalStorage stripping, waitForSave, validateSchema, onError,
 * schema migration, _getActiveBook fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminConfigStore } from '../../../js/admin/AdminConfigStore.js';
import {
  DEFAULT_CONFIG,
  CONFIG_SCHEMA_VERSION,
} from '../../../js/admin/AdminConfigDefaults.js';
import {
  validateSchema,
  mergeWithDefaults,
  migrateSchema,
  ensureBookSettings,
} from '../../../js/admin/AdminConfigMigration.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Создать мок IndexedDB с настраиваемым поведением
 */
function createIDBMock(opts = {}) {
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
      if (opts.putFails) {
        store[key] = undefined;
      } else {
        store[key] = structuredClone(value);
      }
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

  const origObjectStore = mockTransaction.objectStore;
  mockTransaction.objectStore = vi.fn((...args) => {
    const result = origObjectStore(...args);
    if (opts.txFails) {
      setTimeout(() => mockTransaction.onerror?.(new Error('TX fail')));
    } else {
      setTimeout(() => mockTransaction.oncomplete?.());
    }
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
    error: null,
  };

  return {
    open: vi.fn(() => {
      if (opts.openFails) {
        mockRequest.error = new Error('IDB unavailable');
        setTimeout(() => mockRequest.onerror?.());
      } else {
        setTimeout(() => mockRequest.onsuccess?.());
      }
      return mockRequest;
    }),
    _store: store,
    _mockDB: mockDB,
    _mockTransaction: mockTransaction,
  };
}

function createStore() {
  return new AdminConfigStore();
}

describe('AdminConfigStore — Advanced', () => {
  let store;

  beforeEach(() => {
    global.indexedDB = createIDBMock();
    store = createStore();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // validateSchema
  // ═══════════════════════════════════════════════════════════════════════════

  describe('validateSchema()', () => {
    it('should return empty array for valid config', () => {
      const errors = validateSchema(store.getConfig());
      expect(errors).toEqual([]);
    });

    it('should also work via static method on class', () => {
      const errors = AdminConfigStore.validateSchema(store.getConfig());
      expect(errors).toEqual([]);
    });

    it('should report error for null config', () => {
      const errors = validateSchema(null);
      expect(errors).toContain('Конфигурация должна быть объектом');
    });

    it('should report error for non-object config', () => {
      const errors = validateSchema('string');
      expect(errors).toContain('Конфигурация должна быть объектом');
    });

    it('should report missing books array', () => {
      const config = { ...store.getConfig(), books: 'not array' };
      const errors = validateSchema(config);
      expect(errors).toContain('books должен быть массивом');
    });

    it('should report book without id', () => {
      const config = store.getConfig();
      config.books.push({ cover: { title: 'T' }, chapters: [] });
      const errors = validateSchema(config);
      expect(errors.some(e => e.includes('отсутствует id'))).toBe(true);
    });

    it('should report book without cover', () => {
      const config = store.getConfig();
      config.books.push({ id: 'x', chapters: [] });
      const errors = validateSchema(config);
      expect(errors.some(e => e.includes('отсутствует cover'))).toBe(true);
    });

    it('should report book with non-array chapters', () => {
      const config = store.getConfig();
      config.books.push({ id: 'x', cover: { title: 'T' }, chapters: 'bad' });
      const errors = validateSchema(config);
      expect(errors.some(e => e.includes('chapters должен быть массивом'))).toBe(true);
    });

    it('should report non-string activeBookId', () => {
      const config = { ...store.getConfig(), activeBookId: 123 };
      const errors = validateSchema(config);
      expect(errors).toContain('activeBookId должен быть строкой');
    });

    it('should report non-finite fontMin', () => {
      const config = { ...store.getConfig(), fontMin: NaN };
      const errors = validateSchema(config);
      expect(errors).toContain('fontMin должен быть конечным числом');
    });

    it('should report non-finite fontMax', () => {
      const config = { ...store.getConfig(), fontMax: Infinity };
      const errors = validateSchema(config);
      expect(errors).toContain('fontMax должен быть конечным числом');
    });

    it('should report non-number fontMin', () => {
      const config = { ...store.getConfig(), fontMin: 'abc' };
      const errors = validateSchema(config);
      expect(errors).toContain('fontMin должен быть конечным числом');
    });

    it('should report missing readingFonts array', () => {
      const config = { ...store.getConfig(), readingFonts: 'bad' };
      const errors = validateSchema(config);
      expect(errors).toContain('readingFonts должен быть массивом');
    });

    it('should report missing settingsVisibility', () => {
      const config = { ...store.getConfig(), settingsVisibility: null };
      const errors = validateSchema(config);
      expect(errors).toContain('settingsVisibility должен быть объектом');
    });

    it('should collect multiple errors', () => {
      const config = {
        books: 'bad',
        activeBookId: 42,
        fontMin: NaN,
        fontMax: 'x',
        readingFonts: null,
        settingsVisibility: 'bad',
      };
      const errors = validateSchema(config);
      expect(errors.length).toBeGreaterThanOrEqual(5);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _migrateSchema
  // ═══════════════════════════════════════════════════════════════════════════

  describe('migrateSchema()', () => {
    it('should log migration for v1 to current', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      migrateSchema({ _schemaVersion: 1 }, 1);
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('миграция схемы v1')
      );
      spy.mockRestore();
    });

    it('should not log for current version', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      migrateSchema({ _schemaVersion: CONFIG_SCHEMA_VERSION }, CONFIG_SCHEMA_VERSION);
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('should return data unchanged', () => {
      const data = { foo: 'bar', _schemaVersion: 1 };
      const result = migrateSchema(data, 1);
      expect(result.foo).toBe('bar');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _ensureBookSettings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ensureBookSettings()', () => {
    it('should add all missing per-book settings', () => {
      const book = { id: 'test', cover: { title: 'T' }, chapters: [] };
      ensureBookSettings(book, {});

      expect(book.defaultSettings).toBeDefined();
      expect(book.defaultSettings.font).toBe('georgia');
      expect(book.appearance).toBeDefined();
      expect(book.appearance.light).toBeDefined();
      expect(book.appearance.dark).toBeDefined();
      expect(book.sounds).toBeDefined();
      expect(book.ambients).toBeInstanceOf(Array);
      expect(book.decorativeFont).toBeNull();
    });

    it('should use fallback values when available', () => {
      const book = { id: 'test', cover: { title: 'T' }, chapters: [] };
      const fallback = {
        defaultSettings: { font: 'inter', fontSize: 20 },
        sounds: { pageFlip: 'custom.mp3' },
        decorativeFont: { name: 'MyFont', dataUrl: 'data:abc' },
      };
      ensureBookSettings(book, fallback);

      expect(book.defaultSettings.font).toBe('inter');
      expect(book.sounds.pageFlip).toBe('custom.mp3');
      expect(book.decorativeFont.name).toBe('MyFont');
    });

    it('should complete incomplete appearance light/dark', () => {
      const book = {
        id: 'test',
        cover: { title: 'T' },
        chapters: [],
        appearance: { light: { coverBgStart: '#ff0000' } },
      };
      ensureBookSettings(book, {});

      // light should have both custom and default values
      expect(book.appearance.light.coverBgStart).toBe('#ff0000');
      expect(book.appearance.light.bgPage).toBeDefined();
      // dark should have defaults
      expect(book.appearance.dark.coverBgStart).toBe('#111111');
    });

    it('should handle fallback appearance with per-theme', () => {
      const book = { id: 'test', cover: { title: 'T' }, chapters: [] };
      const fallback = {
        appearance: {
          light: { coverBgStart: '#aaa' },
          dark: { coverBgStart: '#bbb' },
        },
      };
      ensureBookSettings(book, fallback);

      expect(book.appearance.light.coverBgStart).toBe('#aaa');
      expect(book.appearance.dark.coverBgStart).toBe('#bbb');
    });

    it('should handle fallback appearance without per-theme (old format)', () => {
      const book = { id: 'test', cover: { title: 'T' }, chapters: [] };
      const fallback = {
        appearance: { coverBgStart: '#abc', fontMin: 10, fontMax: 30 },
      };
      ensureBookSettings(book, fallback);

      // Old format: coverBgStart applied to light only, fontMin/fontMax stripped
      expect(book.appearance.light.coverBgStart).toBe('#abc');
    });

    it('should handle null fallback decorativeFont', () => {
      const book = { id: 'test', cover: { title: 'T' }, chapters: [] };
      ensureBookSettings(book, { decorativeFont: null });
      expect(book.decorativeFont).toBeNull();
    });

    it('should preserve existing book decorativeFont', () => {
      const book = {
        id: 'test', cover: { title: 'T' }, chapters: [],
        decorativeFont: { name: 'Existing' },
      };
      ensureBookSettings(book, { decorativeFont: { name: 'Fallback' } });
      expect(book.decorativeFont.name).toBe('Existing');
    });

    it('should use fallback ambients array', () => {
      const book = { id: 'test', cover: { title: 'T' }, chapters: [] };
      const fallback = {
        ambients: [{ id: 'custom', label: 'Custom' }],
      };
      ensureBookSettings(book, fallback);

      expect(book.ambients).toHaveLength(1);
      expect(book.ambients[0].id).toBe('custom');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIMISTIC LOCKING (_save / _performSave)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('optimistic locking', () => {
    it('should increment version on each save', () => {
      expect(store._version).toBe(0);
      store.updateCover({ title: 'A' });
      expect(store._version).toBe(1);
      store.updateCover({ title: 'B' });
      expect(store._version).toBe(2);
    });

    it('should mark dirty when save called during active save', () => {
      // Manually set saving flag
      store._saving = true;
      store._save();
      expect(store._dirtyDuringSave).toBe(true);
    });

    it('should not start new performSave while saving', () => {
      const spy = vi.spyOn(store, '_performSave');
      store._saving = true;

      store._save(); // Should just mark dirty

      expect(spy).not.toHaveBeenCalled();
      expect(store._dirtyDuringSave).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _saveToLocalStorage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_saveToLocalStorage()', () => {
    it('should strip htmlContent from chapters', () => {
      const snapshot = structuredClone(store.getConfig());
      snapshot.books[0].chapters[0].htmlContent = '<p>Very large HTML content</p>';

      store._saveToLocalStorage(snapshot);

      const saved = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(saved.books[0].chapters[0].htmlContent).toBeUndefined();
      expect(saved.books[0].chapters[0]._idb).toBe(true);
    });

    it('should strip dataUrl from decorative font', () => {
      const snapshot = structuredClone(store.getConfig());
      snapshot.books[0].decorativeFont = { name: 'Font', dataUrl: 'data:font/woff2;base64,xyz' };

      store._saveToLocalStorage(snapshot);

      const saved = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(saved.books[0].decorativeFont.dataUrl).toBeUndefined();
      expect(saved.books[0].decorativeFont._idb).toBe(true);
      expect(saved.books[0].decorativeFont.name).toBe('Font');
    });

    it('should strip data URL from ambients', () => {
      const snapshot = structuredClone(store.getConfig());
      snapshot.books[0].ambients[1].file = 'data:audio/mp3;base64,abc';

      store._saveToLocalStorage(snapshot);

      const saved = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(saved.books[0].ambients[1].file).toBeUndefined();
      expect(saved.books[0].ambients[1]._idb).toBe(true);
    });

    it('should strip data URL from appearance coverBgImage', () => {
      const snapshot = structuredClone(store.getConfig());
      snapshot.books[0].appearance.light.coverBgImage = 'data:image/png;base64,xxx';

      store._saveToLocalStorage(snapshot);

      const saved = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(saved.books[0].appearance.light.coverBgImage).toBeUndefined();
      expect(saved.books[0].appearance.light._idbCoverBgImage).toBe(true);
    });

    it('should strip data URL from appearance customTextureData', () => {
      const snapshot = structuredClone(store.getConfig());
      snapshot.books[0].appearance.dark.customTextureData = 'data:image/png;base64,yyy';

      store._saveToLocalStorage(snapshot);

      const saved = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(saved.books[0].appearance.dark.customTextureData).toBeUndefined();
      expect(saved.books[0].appearance.dark._idbCustomTexture).toBe(true);
    });

    it('should strip dataUrl from reading fonts', () => {
      const snapshot = structuredClone(store.getConfig());
      snapshot.readingFonts[0].dataUrl = 'data:font/woff2;base64,abc';

      store._saveToLocalStorage(snapshot);

      const saved = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(saved.readingFonts[0].dataUrl).toBeUndefined();
      expect(saved.readingFonts[0]._idb).toBe(true);
    });

    it('should not strip non-data URLs', () => {
      const snapshot = structuredClone(store.getConfig());
      snapshot.books[0].ambients[1].file = 'sounds/ambient/rain.mp3';

      store._saveToLocalStorage(snapshot);

      const saved = JSON.parse(localStorage.setItem.mock.calls[0][1]);
      expect(saved.books[0].ambients[1].file).toBe('sounds/ambient/rain.mp3');
      expect(saved.books[0].ambients[1]._idb).toBeUndefined();
    });

    it('should handle localStorage quota error gracefully', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      localStorage.setItem.mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      });

      const snapshot = structuredClone(store.getConfig());

      // Should not throw
      expect(() => store._saveToLocalStorage(snapshot)).not.toThrow();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('localStorage')
      );

      spy.mockRestore();
    });

    it('should not mutate original snapshot', () => {
      const snapshot = structuredClone(store.getConfig());
      snapshot.books[0].chapters[0].htmlContent = '<p>Big content</p>';

      store._saveToLocalStorage(snapshot);

      // Original should still have htmlContent
      expect(snapshot.books[0].chapters[0].htmlContent).toBe('<p>Big content</p>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // waitForSave
  // ═══════════════════════════════════════════════════════════════════════════

  describe('waitForSave()', () => {
    it('should resolve immediately when no save in progress', async () => {
      await expect(store.waitForSave()).resolves.toBeUndefined();
    });

    it('should wait for save to complete', async () => {
      // Trigger a save to create _savePromise
      store.updateCover({ title: 'Test' });

      // waitForSave should resolve (IDB put is mocked to succeed)
      await expect(store.waitForSave()).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // onError callback
  // ═══════════════════════════════════════════════════════════════════════════

  describe('onError callback', () => {
    it('should be null by default', () => {
      expect(store.onError).toBeNull();
    });

    it('should be settable', () => {
      const handler = vi.fn();
      store.onError = handler;
      expect(store.onError).toBe(handler);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _getActiveBook fallback
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_getActiveBook fallback', () => {
    it('should fallback to first book when active book ID is stale', () => {
      // Set active to non-existent
      store._config.activeBookId = 'stale-id';

      // Operations should fall back to first book
      const chapters = store.getChapters();
      expect(chapters.length).toBe(3); // default book has 3 chapters
    });

    it('should return null operations when no books exist', () => {
      store._config.books = [];
      store._config.activeBookId = 'none';

      const chapters = store.getChapters();
      // Returns default chapters since _getActiveBook returns null
      expect(chapters).toBeDefined();
    });

    it('should handle getCover with no active book', () => {
      store._config.books = [];
      const cover = store.getCover();
      expect(cover).toBeDefined();
    });

    it('should handle getSounds with no active book', () => {
      store._config.books = [];
      const sounds = store.getSounds();
      expect(sounds).toBeDefined();
      expect(sounds.pageFlip).toBeDefined();
    });

    it('should handle getAmbients with no active book', () => {
      store._config.books = [];
      const ambients = store.getAmbients();
      expect(ambients).toBeDefined();
      expect(ambients.length).toBe(4);
    });

    it('should handle getDefaultSettings with no active book', () => {
      store._config.books = [];
      const settings = store.getDefaultSettings();
      expect(settings).toBeDefined();
      expect(settings.font).toBe('georgia');
    });

    it('should handle getAppearance with no active book', () => {
      store._config.books = [];
      const appearance = store.getAppearance();
      expect(appearance).toBeDefined();
      expect(appearance.fontMin).toBe(14);
    });

    it('should not mutate when updating with no active book', () => {
      store._config.books = [];

      // These should not throw
      store.updateCover({ title: 'Test' });
      store.addChapter({ id: 'ch' });
      store.updateChapter(0, { id: 'x' });
      store.removeChapter(0);
      store.moveChapter(0, 1);
      store.addAmbient({ id: 'x' });
      store.updateAmbient(0, { label: 'x' });
      store.removeAmbient(0);
      store.updateSounds({ pageFlip: 'x' });
      store.updateDefaultSettings({ font: 'x' });
      store.setDecorativeFont({ name: 'x' });
      store.updateAppearanceTheme('light', { coverBgStart: '#000' });

      expect(store._config.books).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _load (IDB error handling & migration)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_load()', () => {
    it('should fallback to localStorage when IDB fails', async () => {
      // Setup IDB that fails
      global.indexedDB = createIDBMock({ openFails: true });

      const config = {
        books: [{ id: 'ls-book', cover: { title: 'From LS' }, chapters: [] }],
        activeBookId: 'ls-book',
      };
      localStorage.getItem.mockReturnValue(JSON.stringify(config));

      const asyncStore = await AdminConfigStore.create();
      expect(asyncStore.getBooks()[0].title).toBe('From LS');
    });

    it('should return defaults when both IDB and localStorage fail', async () => {
      global.indexedDB = createIDBMock({ openFails: true });
      localStorage.getItem.mockReturnValue(null);

      const asyncStore = await AdminConfigStore.create();
      const config = asyncStore.getConfig();
      expect(config.books.length).toBe(1);
      expect(config.books[0].id).toBe('default');
    });

    it('should return defaults when localStorage has corrupted data', async () => {
      global.indexedDB = createIDBMock({ openFails: true });
      localStorage.getItem.mockReturnValue('{{not json}}');

      const asyncStore = await AdminConfigStore.create();
      expect(asyncStore.getConfig().books[0].id).toBe('default');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Schema version in _mergeWithDefaults
  // ═══════════════════════════════════════════════════════════════════════════

  describe('schema version handling', () => {
    it('should set current schema version on merge', () => {
      const result = mergeWithDefaults({ _schemaVersion: 1 });
      expect(result._schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    });

    it('should default to schema version 1 when missing', () => {
      const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
      mergeWithDefaults({}); // no _schemaVersion => defaults to 1
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('v1')
      );
      spy.mockRestore();
    });

    it('should handle undefined schemaVersion gracefully', () => {
      const result = mergeWithDefaults({ _schemaVersion: undefined });
      expect(result._schemaVersion).toBe(CONFIG_SCHEMA_VERSION);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _mergeWithDefaults — validation warning
  // ═══════════════════════════════════════════════════════════════════════════

  describe('merge validation warning', () => {
    it('should warn on schema validation errors in merged result', () => {
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // books with invalid entry
      mergeWithDefaults({
        books: [{ chapters: 'not-array' }], // invalid book: no id, no cover, chapters not array
      });

      // Should have logged a warning about schema issues
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('расхождение со схемой'),
        expect.any(Array)
      );
      spy.mockRestore();
    });
  });
});
