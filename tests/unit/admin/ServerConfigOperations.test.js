/**
 * Тесты для ServerConfigOperations
 * Вспомогательные функции для серверных CRUD-операций
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  fetchChapters, createChapter, updateChapterByIndex,
  removeChapterByIndex, moveChapterByIndex,
  fetchAmbients, createAmbient, updateAmbientByIndex, removeAmbientByIndex,
  fetchReadingFonts, createReadingFont, updateReadingFontByIndex, removeReadingFontByIndex,
  mapThemeToAPI, mapThemeFromAPI, mapVisibilityToAPI,
} from '../../../js/admin/ServerConfigOperations.js';

describe('ServerConfigOperations', () => {
  let api;

  beforeEach(() => {
    api = {
      getChapters: vi.fn(() => Promise.resolve({
        chapters: [
          { id: 'srv-ch1', title: 'Ch1', filePath: 'ch1.html', hasHtmlContent: true, bg: 'bg1.webp', bgMobile: '' },
          { id: 'srv-ch2', title: 'Ch2', filePath: '', hasHtmlContent: false, bg: '', bgMobile: '' },
        ],
      })),
      createChapter: vi.fn(() => Promise.resolve()),
      updateChapter: vi.fn(() => Promise.resolve()),
      deleteChapter: vi.fn(() => Promise.resolve()),
      reorderChapters: vi.fn(() => Promise.resolve()),
      getAmbients: vi.fn(() => Promise.resolve({
        ambients: [
          { id: 'srv-a1', ambientKey: 'rain', label: 'Rain', shortLabel: 'Rain', icon: '🌧', fileUrl: '/rain.mp3', visible: true, builtin: true },
        ],
      })),
      createAmbient: vi.fn(() => Promise.resolve()),
      updateAmbient: vi.fn(() => Promise.resolve()),
      deleteAmbient: vi.fn(() => Promise.resolve()),
      getFonts: vi.fn(() => Promise.resolve({
        fonts: [
          { id: 'srv-f1', fontKey: 'georgia', label: 'Georgia', family: 'Georgia, serif', builtin: true, enabled: true, fileUrl: null },
        ],
      })),
      createFont: vi.fn(() => Promise.resolve()),
      updateFont: vi.fn(() => Promise.resolve()),
      deleteFont: vi.fn(() => Promise.resolve()),
    };
  });

  // ─── Chapters ─────────────────────────────────────

  describe('fetchChapters', () => {
    it('should map server chapters to internal format', async () => {
      const result = await fetchChapters(api, 'book-1');
      expect(api.getChapters).toHaveBeenCalledWith('book-1');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'srv-ch1', title: 'Ch1', file: 'ch1.html',
        htmlContent: null, _hasHtmlContent: true, bg: 'bg1.webp', bgMobile: '', albumData: null,
      });
    });
  });

  describe('createChapter', () => {
    it('should send chapter data to API', async () => {
      await createChapter(api, 'book-1', { title: 'New', htmlContent: '<p>Hi</p>', file: 'ch1.html' });
      expect(api.createChapter).toHaveBeenCalledWith('book-1', {
        title: 'New', htmlContent: '<p>Hi</p>', filePath: 'ch1.html', bg: '', bgMobile: '',
      });
    });
  });

  describe('updateChapterByIndex', () => {
    it('should update chapter at given index', async () => {
      await updateChapterByIndex(api, 'book-1', 0, { title: 'Updated' });
      expect(api.updateChapter).toHaveBeenCalledWith('book-1', 'srv-ch1', expect.objectContaining({ title: 'Updated' }));
    });

    it('should skip if index out of range', async () => {
      await updateChapterByIndex(api, 'book-1', 99, {});
      expect(api.updateChapter).not.toHaveBeenCalled();
    });

    it('should skip if index is negative', async () => {
      await updateChapterByIndex(api, 'book-1', -1, {});
      expect(api.updateChapter).not.toHaveBeenCalled();
    });
  });

  describe('removeChapterByIndex', () => {
    it('should delete chapter at given index', async () => {
      await removeChapterByIndex(api, 'book-1', 1);
      expect(api.deleteChapter).toHaveBeenCalledWith('book-1', 'srv-ch2');
    });

    it('should skip if index out of range', async () => {
      await removeChapterByIndex(api, 'book-1', 5);
      expect(api.deleteChapter).not.toHaveBeenCalled();
    });
  });

  describe('moveChapterByIndex', () => {
    it('should reorder chapters', async () => {
      await moveChapterByIndex(api, 'book-1', 0, 1);
      expect(api.reorderChapters).toHaveBeenCalledWith('book-1', ['srv-ch2', 'srv-ch1']);
    });

    it('should skip if fromIndex out of range', async () => {
      await moveChapterByIndex(api, 'book-1', -1, 0);
      expect(api.reorderChapters).not.toHaveBeenCalled();
    });

    it('should skip if toIndex out of range', async () => {
      await moveChapterByIndex(api, 'book-1', 0, 99);
      expect(api.reorderChapters).not.toHaveBeenCalled();
    });
  });

  // ─── Ambients ─────────────────────────────────────

  describe('fetchAmbients', () => {
    it('should map server ambients to internal format', async () => {
      const result = await fetchAmbients(api, 'book-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rain');
      expect(result[0].file).toBe('/rain.mp3');
      expect(result[0]._serverId).toBe('srv-a1');
    });
  });

  describe('createAmbient', () => {
    it('should send ambient data to API', async () => {
      await createAmbient(api, 'book-1', { id: 'forest', label: 'Forest', file: '/forest.mp3' });
      expect(api.createAmbient).toHaveBeenCalledWith('book-1', expect.objectContaining({
        ambientKey: 'forest', label: 'Forest', fileUrl: '/forest.mp3',
      }));
    });
  });

  describe('updateAmbientByIndex', () => {
    it('should update ambient at given index', async () => {
      await updateAmbientByIndex(api, 'book-1', 0, { label: 'Updated Rain' });
      expect(api.updateAmbient).toHaveBeenCalledWith('book-1', 'srv-a1', { label: 'Updated Rain' });
    });

    it('should skip if index out of range', async () => {
      await updateAmbientByIndex(api, 'book-1', 99, {});
      expect(api.updateAmbient).not.toHaveBeenCalled();
    });
  });

  describe('removeAmbientByIndex', () => {
    it('should delete ambient at given index', async () => {
      await removeAmbientByIndex(api, 'book-1', 0);
      expect(api.deleteAmbient).toHaveBeenCalledWith('book-1', 'srv-a1');
    });
  });

  // ─── Reading Fonts ────────────────────────────────

  describe('fetchReadingFonts', () => {
    it('should map server fonts to internal format', async () => {
      const result = await fetchReadingFonts(api);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('georgia');
      expect(result[0].dataUrl).toBeNull();
      expect(result[0]._serverId).toBe('srv-f1');
    });
  });

  describe('createReadingFont', () => {
    it('should send font data to API', async () => {
      await createReadingFont(api, { id: 'custom', label: 'Custom', family: 'Custom, serif' });
      expect(api.createFont).toHaveBeenCalledWith(expect.objectContaining({
        fontKey: 'custom', label: 'Custom', family: 'Custom, serif',
      }));
    });
  });

  describe('updateReadingFontByIndex', () => {
    it('should update font at given index', async () => {
      await updateReadingFontByIndex(api, 0, { enabled: false });
      expect(api.updateFont).toHaveBeenCalledWith('srv-f1', { enabled: false });
    });

    it('should skip if index out of range', async () => {
      await updateReadingFontByIndex(api, 99, {});
      expect(api.updateFont).not.toHaveBeenCalled();
    });
  });

  describe('removeReadingFontByIndex', () => {
    it('should delete font at given index', async () => {
      await removeReadingFontByIndex(api, 0);
      expect(api.deleteFont).toHaveBeenCalledWith('srv-f1');
    });
  });

  // ─── Mappers ──────────────────────────────────────

  describe('mapThemeToAPI', () => {
    it('should map internal fields to API field names', () => {
      const result = mapThemeToAPI({
        coverBgStart: '#fff',
        coverBgEnd: '#000',
        coverText: '#333',
        coverBgImage: '/img.png',
        pageTexture: 'none',
        customTextureData: '/tex.png',
        bgPage: '#fdf',
        bgApp: '#e6e',
      });
      expect(result.coverBgStart).toBe('#fff');
      expect(result.coverBgImageUrl).toBe('/img.png');
      expect(result.customTextureUrl).toBe('/tex.png');
      expect(result.coverBgImage).toBeUndefined();
    });

    it('should only include defined fields', () => {
      const result = mapThemeToAPI({ coverBgStart: '#fff' });
      expect(Object.keys(result)).toEqual(['coverBgStart']);
    });
  });

  describe('mapThemeFromAPI', () => {
    it('should map API fields to internal field names', () => {
      const result = mapThemeFromAPI({
        coverBgStart: '#fff',
        coverBgImageUrl: '/img.png',
        customTextureUrl: '/tex.png',
      });
      expect(result.coverBgImage).toBe('/img.png');
      expect(result.customTextureData).toBe('/tex.png');
      expect(result.coverBgImageUrl).toBeUndefined();
    });

    it('should return empty object for null input', () => {
      expect(mapThemeFromAPI(null)).toEqual({});
    });
  });

  describe('mapVisibilityToAPI', () => {
    it('should map internal visibility to API format', () => {
      const result = mapVisibilityToAPI({
        fontSize: true,
        theme: false,
        font: true,
        fullscreen: false,
        sound: true,
        ambient: false,
      });
      expect(result.visFontSize).toBe(true);
      expect(result.visTheme).toBe(false);
      expect(result.visFont).toBe(true);
      expect(result.visFullscreen).toBe(false);
      expect(result.visSound).toBe(true);
      expect(result.visAmbient).toBe(false);
    });

    it('should only include defined fields', () => {
      const result = mapVisibilityToAPI({ fontSize: true });
      expect(Object.keys(result)).toEqual(['visFontSize']);
    });
  });
});
