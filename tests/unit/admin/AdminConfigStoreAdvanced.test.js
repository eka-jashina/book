/**
 * TESTS: AdminConfigStore — Advanced
 * Тесты для расширенных сценариев: IDB ошибки, оптимистичная блокировка,
 * _saveToLocalStorage stripping, waitForSave, validateSchema, onError,
 * schema migration, _getActiveBook fallback.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AdminConfigStore } from '../../../js/admin/AdminConfigStore.js';

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
  // validateSchema (static delegation)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('validateSchema()', () => {
    it('should delegate to AdminConfigMigration.validateSchema via static method', () => {
      const errors = AdminConfigStore.validateSchema(store.getConfig());
      expect(errors).toEqual([]);
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

});
