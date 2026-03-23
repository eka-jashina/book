/**
 * TESTS: ServerAdminConfigStore
 * Тесты для серверного адаптера конфигурации admin panel
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerAdminConfigStore } from '../../../js/admin/ServerAdminConfigStore.js';

describe('ServerAdminConfigStore', () => {
  let store;
  let mockApi;

  const mockBooks = [
    { id: 'b1', title: 'Book 1', author: 'Author 1', chaptersCount: 3, position: 0 },
    { id: 'b2', title: 'Book 2', author: 'Author 2', chaptersCount: 1, position: 1 },
  ];

  function createMockApi() {
    return {
      getBooks: vi.fn().mockResolvedValue({ books: [...mockBooks] }),
      createBook: vi.fn().mockResolvedValue({ id: 'b3', title: 'New', author: '', position: 2 }),
      getBook: vi.fn().mockResolvedValue({
        id: 'b1', title: 'Book 1', author: 'Author 1',
        cover: { bg: '', bgMobile: '', bgMode: 'default', bgCustomUrl: null },
      }),
      updateBook: vi.fn().mockResolvedValue({ id: 'b1' }),
      deleteBook: vi.fn().mockResolvedValue(null),
      reorderBooks: vi.fn().mockResolvedValue(null),
      getChapters: vi.fn().mockResolvedValue({ chapters: [
        { id: 'c1', title: 'Ch1', position: 0 },
        { id: 'c2', title: 'Ch2', position: 1 },
      ] }),
      createChapter: vi.fn().mockResolvedValue({ id: 'c3' }),
      updateChapter: vi.fn().mockResolvedValue({ id: 'c1' }),
      deleteChapter: vi.fn().mockResolvedValue(null),
      reorderChapters: vi.fn().mockResolvedValue(null),
      getAmbients: vi.fn().mockResolvedValue({ ambients: [
        { id: 'a1', label: 'Rain', position: 0 },
      ] }),
      createAmbient: vi.fn().mockResolvedValue({ id: 'a2' }),
      updateAmbient: vi.fn().mockResolvedValue({}),
      deleteAmbient: vi.fn().mockResolvedValue(null),
      reorderAmbients: vi.fn().mockResolvedValue(null),
      getSounds: vi.fn().mockResolvedValue({ pageFlip: 'flip.mp3' }),
      updateSounds: vi.fn().mockResolvedValue({}),
      getDefaultSettings: vi.fn().mockResolvedValue({ font: 'georgia' }),
      updateDefaultSettings: vi.fn().mockResolvedValue({}),
      getDecorativeFont: vi.fn().mockResolvedValue(null),
      setDecorativeFont: vi.fn().mockResolvedValue({}),
      deleteDecorativeFont: vi.fn().mockResolvedValue(null),
      getFonts: vi.fn().mockResolvedValue({ fonts: [
        { id: 'f1', label: 'Georgia', family: 'Georgia, serif', position: 0 },
      ] }),
      createFont: vi.fn().mockResolvedValue({ id: 'f2' }),
      updateFont: vi.fn().mockResolvedValue({}),
      deleteFont: vi.fn().mockResolvedValue(null),
      reorderFonts: vi.fn().mockResolvedValue(null),
      getAppearance: vi.fn().mockResolvedValue({ fontMin: 14, fontMax: 22 }),
      updateAppearance: vi.fn().mockResolvedValue({}),
      updateAppearanceTheme: vi.fn().mockResolvedValue({}),
      getSettings: vi.fn().mockResolvedValue({ fontMin: 14, fontMax: 22 }),
      updateSettings: vi.fn().mockResolvedValue({}),
      exportConfig: vi.fn().mockResolvedValue({ books: [] }),
      importConfig: vi.fn().mockResolvedValue(null),
    };
  }

  beforeEach(async () => {
    mockApi = createMockApi();
    store = await ServerAdminConfigStore.create(mockApi);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Static factory
  // ═══════════════════════════════════════════════════════════════════════════

  describe('create', () => {
    it('should load books and set first as active', () => {
      expect(store.getActiveBookId()).toBe('b1');
      expect(store.getBooks()).toHaveLength(2);
    });

    it('should handle empty books list', async () => {
      mockApi.getBooks.mockResolvedValue({ books: [] });
      const emptyStore = await ServerAdminConfigStore.create(mockApi);

      expect(emptyStore.getActiveBookId()).toBeNull();
      expect(emptyStore.getBooks()).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Books
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBooks', () => {
    it('should return mapped books from cache', () => {
      const books = store.getBooks();

      expect(books[0]).toEqual(expect.objectContaining({
        id: 'b1',
        title: 'Book 1',
        author: 'Author 1',
        chaptersCount: 3,
      }));
    });
  });

  describe('setActiveBook', () => {
    it('should set active book', () => {
      store.setActiveBook('b2');
      expect(store.getActiveBookId()).toBe('b2');
    });
  });

  describe('addBook', () => {
    it('should create book via API and update cache', async () => {
      await store.addBook({ title: 'New Book', author: '' });

      expect(mockApi.createBook).toHaveBeenCalledWith(expect.objectContaining({ title: 'New Book' }));
    });

    it('should add book to local cache', async () => {
      const booksBefore = store.getBooks().length;
      await store.addBook({ title: 'New' });
      expect(store.getBooks().length).toBe(booksBefore + 1);
    });
  });

  describe('removeBook', () => {
    it('should delete book via API', async () => {
      await store.removeBook('b2');

      expect(mockApi.deleteBook).toHaveBeenCalledWith('b2');
    });

    it('should update active book if deleted was active', async () => {
      store.setActiveBook('b1');

      await store.removeBook('b1');

      // После удаления b1, активной должна стать b2
      expect(store.getActiveBookId()).toBe('b2');
    });

    it('should set empty active when all deleted', async () => {
      await store.removeBook('b2');
      await store.removeBook('b1');

      expect(store.getActiveBookId()).toBe('');
    });
  });

  describe('updateBookMeta', () => {
    it('should update book title and author', async () => {
      await store.updateBookMeta('b1', { title: 'Updated', author: 'New Author' });

      expect(mockApi.updateBook).toHaveBeenCalledWith('b1', { title: 'Updated', author: 'New Author' });
    });

    it('should update local cache', async () => {
      await store.updateBookMeta('b1', { title: 'Updated' });

      const books = store.getBooks();
      expect(books[0].title).toBe('Updated');
    });
  });

  describe('moveBook', () => {
    it('should reorder books via API', async () => {
      await store.moveBook(0, 1);

      expect(mockApi.reorderBooks).toHaveBeenCalled();
    });

    it('should ignore invalid indices', async () => {
      await store.moveBook(-1, 0);
      expect(mockApi.reorderBooks).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Chapters
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getChapters', () => {
    it('should fetch chapters for active book', async () => {
      const chapters = await store.getChapters();

      expect(mockApi.getChapters).toHaveBeenCalledWith('b1');
      expect(chapters).toHaveLength(2);
    });
  });

  describe('addChapter', () => {
    it('should create chapter for active book', async () => {
      await store.addChapter({ title: 'New Chapter' });

      expect(mockApi.createChapter).toHaveBeenCalledWith('b1', expect.objectContaining({
        title: 'New Chapter',
      }));
    });
  });

  describe('updateChapter', () => {
    it('should update chapter by index', async () => {
      await store.updateChapter(0, { title: 'Updated' });

      expect(mockApi.updateChapter).toHaveBeenCalledWith('b1', 'c1', expect.objectContaining({
        title: 'Updated',
      }));
    });
  });

  describe('removeChapter', () => {
    it('should delete chapter by index', async () => {
      await store.removeChapter(1);

      expect(mockApi.deleteChapter).toHaveBeenCalledWith('b1', 'c2');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Sounds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSounds', () => {
    it('should fetch sounds for active book', async () => {
      const sounds = await store.getSounds();

      expect(mockApi.getSounds).toHaveBeenCalledWith('b1');
      expect(sounds.pageFlip).toBe('flip.mp3');
      expect(sounds).toHaveProperty('bookOpen');
      expect(sounds).toHaveProperty('bookClose');
    });
  });

  describe('updateSounds', () => {
    it('should update sounds for active book', async () => {
      await store.updateSounds({ pageFlip: 'new.mp3' });

      expect(mockApi.updateSounds).toHaveBeenCalledWith('b1', { pageFlipUrl: 'new.mp3' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Ambients
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getAmbients', () => {
    it('should fetch ambients for active book', async () => {
      const ambients = await store.getAmbients();

      expect(mockApi.getAmbients).toHaveBeenCalledWith('b1');
      expect(ambients).toHaveLength(1);
    });
  });

  describe('addAmbient', () => {
    it('should create ambient for active book', async () => {
      await store.addAmbient({ label: 'Fire' });

      expect(mockApi.createAmbient).toHaveBeenCalledWith('b1', expect.anything());
    });
  });

  describe('removeAmbient', () => {
    it('should delete ambient by index', async () => {
      await store.removeAmbient(0);

      expect(mockApi.deleteAmbient).toHaveBeenCalledWith('b1', 'a1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Default Settings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getDefaultSettings', () => {
    it('should fetch default settings for active book', async () => {
      const settings = await store.getDefaultSettings();

      expect(mockApi.getDefaultSettings).toHaveBeenCalledWith('b1');
      expect(settings).toEqual({ font: 'georgia' });
    });
  });

  describe('updateDefaultSettings', () => {
    it('should update default settings', async () => {
      await store.updateDefaultSettings({ font: 'inter' });

      expect(mockApi.updateDefaultSettings).toHaveBeenCalledWith('b1', { font: 'inter' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Decorative Font
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getDecorativeFont', () => {
    it('should fetch decorative font', async () => {
      mockApi.getDecorativeFont.mockResolvedValue({ name: 'Fancy' });

      const font = await store.getDecorativeFont();
      expect(font).toEqual({ name: 'Fancy' });
    });

    it('should return null when no decorative font', async () => {
      const font = await store.getDecorativeFont();
      expect(font).toBeNull();
    });
  });

  describe('setDecorativeFont', () => {
    it('should set decorative font with data', async () => {
      await store.setDecorativeFont({ name: 'Fancy', dataUrl: 'data:...' });

      expect(mockApi.setDecorativeFont).toHaveBeenCalledWith('b1', expect.anything());
    });

    it('should delete decorative font when null passed', async () => {
      await store.setDecorativeFont(null);

      expect(mockApi.deleteDecorativeFont).toHaveBeenCalledWith('b1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Reading Fonts
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getReadingFonts', () => {
    it('should fetch reading fonts', async () => {
      const fonts = await store.getReadingFonts();

      expect(mockApi.getFonts).toHaveBeenCalled();
      expect(fonts).toHaveLength(1);
    });
  });

  describe('addReadingFont', () => {
    it('should create reading font', async () => {
      await store.addReadingFont({ label: 'Custom' });

      expect(mockApi.createFont).toHaveBeenCalled();
    });
  });

  describe('removeReadingFont', () => {
    it('should delete reading font by index', async () => {
      await store.removeReadingFont(0);

      expect(mockApi.deleteFont).toHaveBeenCalledWith('f1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Appearance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getAppearance', () => {
    it('should fetch and merge appearance with global settings', async () => {
      const appearance = await store.getAppearance();

      expect(mockApi.getAppearance).toHaveBeenCalledWith('b1');
      expect(mockApi.getSettings).toHaveBeenCalled();
      expect(appearance).toBeDefined();
    });
  });

  describe('updateAppearanceTheme', () => {
    it('should update theme appearance', async () => {
      await store.updateAppearanceTheme('dark', { bgPage: '#000' });

      expect(mockApi.updateAppearanceTheme).toHaveBeenCalledWith('b1', 'dark', expect.objectContaining({ bgPage: '#000' }));
    });

    it('should ignore invalid theme names', async () => {
      await store.updateAppearanceTheme('sepia', { bgPage: '#000' });
      expect(mockApi.updateAppearanceTheme).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Settings Visibility
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSettingsVisibility', () => {
    it('should fetch settings visibility from global settings', async () => {
      mockApi.getSettings.mockResolvedValue({
        settingsVisibility: { fontSize: true, theme: false, font: true },
      });

      const visibility = await store.getSettingsVisibility();

      expect(visibility).toEqual({ fontSize: true, theme: false, font: true });
    });

    it('should return defaults when settings API fails', async () => {
      mockApi.getSettings.mockRejectedValue(new Error('fail'));

      const visibility = await store.getSettingsVisibility();

      expect(visibility).toEqual(expect.objectContaining({ fontSize: true, theme: true }));
    });
  });

  describe('updateSettingsVisibility', () => {
    it('should map field names to API format', async () => {
      await store.updateSettingsVisibility({ fontSize: true, theme: false });

      expect(mockApi.updateSettings).toHaveBeenCalledWith(expect.objectContaining({
        visFontSize: true,
        visTheme: false,
      }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Export / Import / Reset
  // ═══════════════════════════════════════════════════════════════════════════

  describe('exportJSON', () => {
    it('should export config as JSON string', async () => {
      const result = await store.exportJSON();

      expect(mockApi.exportConfig).toHaveBeenCalled();
      expect(typeof result).toBe('string');
    });
  });

  describe('importJSON', () => {
    it('should import config from JSON string', async () => {
      await store.importJSON('{"books":[]}');

      expect(mockApi.importConfig).toHaveBeenCalledWith({ books: [] });
    });

    it('should reload books after import', async () => {
      const callsBefore = mockApi.getBooks.mock.calls.length;

      await store.importJSON('{"books":[]}');

      expect(mockApi.getBooks.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  describe('reset', () => {
    it('should delete all books', async () => {
      await store.reset();

      // Должен удалить все книги
      expect(mockApi.deleteBook).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Error handling
  // ═══════════════════════════════════════════════════════════════════════════

  describe('error handling', () => {
    it('should call onError callback on API failure', async () => {
      const onError = vi.fn();
      store.onError = onError;
      mockApi.createChapter.mockRejectedValue(new Error('Network error'));

      await expect(store.addChapter({ title: 'Test' })).rejects.toThrow('Network error');

      expect(onError).toHaveBeenCalledWith(expect.stringContaining('Network error'));
    });

    it('should throw error even without onError callback', async () => {
      mockApi.updateSounds.mockRejectedValue(new Error('Error'));

      await expect(store.updateSounds({ pageFlip: 'x' })).rejects.toThrow('Error');
    });

    it('should return defaults for getChapters when no active book', async () => {
      store._activeBookId = null;
      const result = await store.getChapters();
      expect(result).toEqual([]);
    });

    it('should return defaults for getSounds when no active book', async () => {
      store._activeBookId = null;
      const result = await store.getSounds();
      expect(result).toEqual({ pageFlip: '', bookOpen: '', bookClose: '' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _save (compatibility stub)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_save', () => {
    it('should be callable without throwing', () => {
      expect(() => store._save()).not.toThrow();
    });
  });

  describe('waitForSave', () => {
    it('should resolve immediately if no pending save', async () => {
      await expect(store.waitForSave()).resolves.toBeUndefined();
    });
  });
});
