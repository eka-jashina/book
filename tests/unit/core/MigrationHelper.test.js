/**
 * TESTS: MigrationHelper
 * Тесты для миграции данных из localStorage/IndexedDB на сервер
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MigrationHelper } from '@core/MigrationHelper.js';

describe('MigrationHelper', () => {
  let helper;
  let mockApi;

  beforeEach(() => {
    mockApi = {
      getBooks: vi.fn().mockResolvedValue([]),
      importConfig: vi.fn().mockResolvedValue(null),
    };
    helper = new MigrationHelper(mockApi);

    // Мок indexedDB
    global.indexedDB = {
      open: vi.fn(),
      deleteDatabase: vi.fn(),
    };

    // Мок confirm
    global.confirm = vi.fn().mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should store apiClient reference', () => {
      expect(helper._api).toBe(mockApi);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkAndMigrate — server has books
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkAndMigrate - server has books', () => {
    it('should return false and clear local data if server has books', async () => {
      mockApi.getBooks.mockResolvedValue([{ id: 1 }]);

      const result = await helper.checkAndMigrate();

      expect(result).toBe(false);
      expect(localStorage.removeItem).toHaveBeenCalledWith('flipbook-admin-config');
    });

    it('should not prompt user if server has books', async () => {
      mockApi.getBooks.mockResolvedValue([{ id: 1 }]);

      await helper.checkAndMigrate();

      expect(global.confirm).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkAndMigrate — no local data
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkAndMigrate - no local data', () => {
    it('should return false if no local config', async () => {
      localStorage.getItem.mockReturnValue(null);

      const result = await helper.checkAndMigrate();

      expect(result).toBe(false);
      expect(global.confirm).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkAndMigrate — has local data, no real content
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkAndMigrate - default data only', () => {
    it('should return false for empty books array', async () => {
      localStorage.getItem.mockReturnValue(JSON.stringify({ books: [] }));

      const result = await helper.checkAndMigrate();

      expect(result).toBe(false);
      expect(global.confirm).not.toHaveBeenCalled();
    });

    it('should return false for single default book with no chapters', async () => {
      localStorage.getItem.mockReturnValue(JSON.stringify({
        books: [{ id: 'default', chapters: [] }],
      }));

      const result = await helper.checkAndMigrate();

      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkAndMigrate — user confirms import
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkAndMigrate - user confirms import', () => {
    const localConfig = {
      books: [{
        id: 'book1',
        cover: { title: 'Test Book', author: 'Author' },
        chapters: [{ id: 'ch1', title: 'Chapter 1', file: 'ch1.html' }],
        sounds: { pageFlip: 'flip.mp3', bookOpen: 'open.mp3', bookClose: 'close.mp3' },
        ambients: [],
        appearance: null,
        decorativeFont: null,
        defaultSettings: null,
      }],
      readingFonts: [{ id: 'font1', label: 'Custom', family: 'sans-serif', builtin: false, enabled: true }],
      settingsVisibility: {},
      fontMin: 14,
      fontMax: 22,
    };

    beforeEach(() => {
      localStorage.getItem.mockReturnValue(JSON.stringify(localConfig));
      global.confirm.mockReturnValue(true);
    });

    it('should return true when import succeeds', async () => {
      const result = await helper.checkAndMigrate();

      expect(result).toBe(true);
      expect(mockApi.importConfig).toHaveBeenCalled();
    });

    it('should convert local config to import format', async () => {
      await helper.checkAndMigrate();

      const importData = mockApi.importConfig.mock.calls[0][0];
      expect(importData.books).toHaveLength(1);
      expect(importData.books[0].title).toBe('Test Book');
      expect(importData.books[0].author).toBe('Author');
      expect(importData.books[0].chapters).toHaveLength(1);
      expect(importData.readingFonts).toHaveLength(1);
      expect(importData.globalSettings.fontMin).toBe(14);
      expect(importData.globalSettings.fontMax).toBe(22);
    });

    it('should clear local data after successful import', async () => {
      await helper.checkAndMigrate();

      expect(localStorage.removeItem).toHaveBeenCalledWith('flipbook-admin-config');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkAndMigrate — user declines
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkAndMigrate - user declines', () => {
    beforeEach(() => {
      localStorage.getItem.mockReturnValue(JSON.stringify({
        books: [{ id: 'book1', chapters: [{ id: 'ch1' }] }],
      }));
      global.confirm.mockReturnValue(false);
    });

    it('should return false when user declines', async () => {
      const result = await helper.checkAndMigrate();

      expect(result).toBe(false);
      expect(mockApi.importConfig).not.toHaveBeenCalled();
    });

    it('should clear local data even when declined', async () => {
      await helper.checkAndMigrate();

      expect(localStorage.removeItem).toHaveBeenCalledWith('flipbook-admin-config');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkAndMigrate — import error
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkAndMigrate - import error', () => {
    it('should return false on import error', async () => {
      localStorage.getItem.mockReturnValue(JSON.stringify({
        books: [{ id: 'book1', chapters: [{ id: 'ch1' }] }],
      }));
      global.confirm.mockReturnValue(true);
      mockApi.importConfig.mockRejectedValue(new Error('Import failed'));

      const result = await helper.checkAndMigrate();

      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _hasRealData
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_hasRealData', () => {
    it('should return false for no books', () => {
      expect(helper._hasRealData({ books: [] })).toBe(false);
    });

    it('should return false for single default book with no chapters', () => {
      expect(helper._hasRealData({ books: [{ id: 'default', chapters: [] }] })).toBe(false);
    });

    it('should return true for book with chapters', () => {
      expect(helper._hasRealData({
        books: [{ id: 'book1', chapters: [{ id: 'ch1' }] }],
      })).toBe(true);
    });

    it('should return true for multiple books', () => {
      expect(helper._hasRealData({
        books: [{ id: 'default' }, { id: 'book2' }],
      })).toBe(true);
    });

    it('should return true for default book with chapters', () => {
      expect(helper._hasRealData({
        books: [{ id: 'default', chapters: [{ id: 'ch1' }] }],
      })).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _convertToImportFormat
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_convertToImportFormat', () => {
    it('should convert books with cover data', () => {
      const config = {
        books: [{
          cover: { title: 'Title', author: 'Author', bg: 'bg.jpg', bgMobile: 'bg-m.jpg', bgMode: 'custom', bgCustomData: 'data:...' },
          chapters: [],
          ambients: [],
        }],
        readingFonts: [],
      };

      const result = helper._convertToImportFormat(config);

      expect(result.books[0].title).toBe('Title');
      expect(result.books[0].author).toBe('Author');
      expect(result.books[0].cover.bg).toBe('bg.jpg');
      expect(result.books[0].cover.bgCustomUrl).toBe('data:...');
    });

    it('should convert chapters', () => {
      const config = {
        books: [{
          cover: {},
          chapters: [
            { title: 'Ch1', file: 'ch1.html', bg: 'bg1.jpg', bgMobile: 'bg1-m.jpg' },
            { title: 'Ch2', htmlContent: '<p>text</p>' },
          ],
          ambients: [],
        }],
        readingFonts: [],
      };

      const result = helper._convertToImportFormat(config);

      expect(result.books[0].chapters).toHaveLength(2);
      expect(result.books[0].chapters[0].filePath).toBe('ch1.html');
      expect(result.books[0].chapters[1].hasHtmlContent).toBe(true);
    });

    it('should convert ambients', () => {
      const config = {
        books: [{
          cover: {},
          chapters: [],
          ambients: [
            { id: 'rain', label: 'Rain', shortLabel: 'R', icon: '🌧', file: 'rain.mp3', visible: true, builtin: true },
          ],
        }],
        readingFonts: [],
      };

      const result = helper._convertToImportFormat(config);

      expect(result.books[0].ambients[0].ambientKey).toBe('rain');
      expect(result.books[0].ambients[0].label).toBe('Rain');
      expect(result.books[0].ambients[0].fileUrl).toBe('rain.mp3');
    });

    it('should convert reading fonts', () => {
      const config = {
        books: [{ cover: {}, chapters: [], ambients: [] }],
        readingFonts: [
          { id: 'custom', label: 'Custom Font', family: 'CustomFont, sans-serif', builtin: false, enabled: true, dataUrl: 'data:font...' },
        ],
      };

      const result = helper._convertToImportFormat(config);

      expect(result.readingFonts[0].fontKey).toBe('custom');
      expect(result.readingFonts[0].fileUrl).toBe('data:font...');
    });

    it('should convert global settings', () => {
      const config = {
        books: [{ cover: {}, chapters: [], ambients: [] }],
        readingFonts: [],
        fontMin: 12,
        fontMax: 24,
        settingsVisibility: { theme: true },
      };

      const result = helper._convertToImportFormat(config);

      expect(result.globalSettings.fontMin).toBe(12);
      expect(result.globalSettings.fontMax).toBe(24);
      expect(result.globalSettings.settingsVisibility.theme).toBe(true);
    });

    it('should convert appearance with light/dark themes', () => {
      const config = {
        books: [{
          cover: {},
          chapters: [],
          ambients: [],
          appearance: {
            light: { coverBgStart: '#fff', coverBgEnd: '#eee', coverText: '#000', bgPage: '#fff', bgApp: '#f5f5f5', pageTexture: 'none' },
            dark: { coverBgStart: '#333', coverBgEnd: '#222', coverText: '#fff', bgPage: '#1a1a1a', bgApp: '#000', pageTexture: 'dark' },
          },
        }],
        readingFonts: [],
        fontMin: 14,
        fontMax: 22,
      };

      const result = helper._convertToImportFormat(config);

      expect(result.books[0].appearance.light.coverBgStart).toBe('#fff');
      expect(result.books[0].appearance.dark.bgApp).toBe('#000');
    });

    it('should convert decorative font', () => {
      const config = {
        books: [{
          cover: {},
          chapters: [],
          ambients: [],
          decorativeFont: { name: 'FancyFont', dataUrl: 'data:font...' },
        }],
        readingFonts: [],
      };

      const result = helper._convertToImportFormat(config);

      expect(result.books[0].decorativeFont.name).toBe('FancyFont');
      expect(result.books[0].decorativeFont.fileUrl).toBe('data:font...');
    });

    it('should handle missing optional fields gracefully', () => {
      const config = {
        books: [{
          cover: {},
          chapters: [],
        }],
      };

      const result = helper._convertToImportFormat(config);

      expect(result.books[0].title).toBe('');
      expect(result.books[0].ambients).toEqual([]);
      expect(result.readingFonts).toEqual([]);
      expect(result.globalSettings.fontMin).toBe(14); // defaults
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _clearLocalData
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_clearLocalData', () => {
    it('should remove admin config from localStorage', () => {
      helper._clearLocalData();

      expect(localStorage.removeItem).toHaveBeenCalledWith('flipbook-admin-config');
    });

    it('should preserve reader-settings keys (reading progress cache)', () => {
      const store = localStorage.__getStore();
      store['reader-settings'] = '{}';
      store['reader-settings:book1'] = '{}';
      store['other-key'] = 'value';
      localStorage.__setStore(store);

      helper._clearLocalData();

      // reader-settings не удаляются — они содержат прогресс чтения,
      // нужный для быстрого доступа до загрузки серверных данных
      expect(localStorage.removeItem).not.toHaveBeenCalledWith('reader-settings');
      expect(localStorage.removeItem).not.toHaveBeenCalledWith('reader-settings:book1');
    });

    it('should delete IndexedDB database', () => {
      helper._clearLocalData();

      expect(indexedDB.deleteDatabase).toHaveBeenCalledWith('flipbook-admin');
    });

    it('should clear sessionStorage keys', () => {
      helper._clearLocalData();

      expect(sessionStorage.removeItem).toHaveBeenCalledWith('flipbook-reading-session');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('flipbook-admin-mode');
      expect(sessionStorage.removeItem).toHaveBeenCalledWith('flipbook-admin-edit-book');
    });

    it('should not throw if localStorage fails', () => {
      localStorage.removeItem.mockImplementation(() => { throw new Error('Fail'); });

      expect(() => helper._clearLocalData()).not.toThrow();
    });
  });
});
