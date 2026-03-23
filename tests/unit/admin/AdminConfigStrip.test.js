/**
 * Тесты для AdminConfigStrip
 * Подготовка снимка конфигурации к сохранению в localStorage
 */
import { describe, it, expect } from 'vitest';

import { stripDataUrl, stripBookDataUrls } from '../../../js/admin/AdminConfigStrip.js';

describe('AdminConfigStrip', () => {
  describe('stripDataUrl', () => {
    it('should replace data URL with _idb marker', () => {
      const obj = { file: 'data:audio/mp3;base64,AAAA' };
      stripDataUrl(obj, 'file');
      expect(obj._idb).toBe(true);
      expect(obj.file).toBeUndefined();
    });

    it('should not strip non-data URLs', () => {
      const obj = { file: 'sounds/rain.mp3' };
      stripDataUrl(obj, 'file');
      expect(obj._idb).toBeUndefined();
      expect(obj.file).toBe('sounds/rain.mp3');
    });

    it('should not strip if field is undefined', () => {
      const obj = {};
      stripDataUrl(obj, 'file');
      expect(obj._idb).toBeUndefined();
    });

    it('should not strip if field is null', () => {
      const obj = { file: null };
      stripDataUrl(obj, 'file');
      expect(obj._idb).toBeUndefined();
    });

    it('should use custom marker field name', () => {
      const obj = { coverBgImage: 'data:image/png;base64,iVBOR' };
      stripDataUrl(obj, 'coverBgImage', '_idbCoverBgImage');
      expect(obj._idbCoverBgImage).toBe(true);
      expect(obj.coverBgImage).toBeUndefined();
    });
  });

  describe('stripBookDataUrls', () => {
    it('should strip htmlContent from chapters', () => {
      const book = {
        chapters: [
          { id: 'ch1', htmlContent: '<p>Chapter content</p>' },
          { id: 'ch2', file: 'content/ch2.html' },
        ],
      };
      stripBookDataUrls(book);
      expect(book.chapters[0]._idb).toBe(true);
      expect(book.chapters[0].htmlContent).toBeUndefined();
      expect(book.chapters[1]._idb).toBeUndefined();
    });

    it('should strip decorativeFont dataUrl', () => {
      const book = {
        decorativeFont: { name: 'FancyFont', dataUrl: 'data:font/woff2;base64,AAAA' },
      };
      stripBookDataUrls(book);
      expect(book.decorativeFont.name).toBe('FancyFont');
      expect(book.decorativeFont._idb).toBe(true);
      expect(book.decorativeFont.dataUrl).toBeUndefined();
    });

    it('should not strip decorativeFont without dataUrl', () => {
      const book = { decorativeFont: { name: 'BuiltIn' } };
      stripBookDataUrls(book);
      expect(book.decorativeFont.name).toBe('BuiltIn');
      expect(book.decorativeFont._idb).toBeUndefined();
    });

    it('should strip data URLs from ambients', () => {
      const book = {
        ambients: [
          { id: 'rain', file: 'data:audio/mp3;base64,RAIN' },
          { id: 'cafe', file: 'sounds/cafe.mp3' },
        ],
      };
      stripBookDataUrls(book);
      expect(book.ambients[0]._idb).toBe(true);
      expect(book.ambients[0].file).toBeUndefined();
      expect(book.ambients[1]._idb).toBeUndefined();
      expect(book.ambients[1].file).toBe('sounds/cafe.mp3');
    });

    it('should strip coverBgImage from appearance themes', () => {
      const book = {
        appearance: {
          light: { coverBgImage: 'data:image/png;base64,LIGHT' },
          dark: { coverBgImage: null },
        },
      };
      stripBookDataUrls(book);
      expect(book.appearance.light._idbCoverBgImage).toBe(true);
      expect(book.appearance.light.coverBgImage).toBeUndefined();
      expect(book.appearance.dark._idbCoverBgImage).toBeUndefined();
    });

    it('should strip customTextureData from appearance themes', () => {
      const book = {
        appearance: {
          light: { customTextureData: 'data:image/png;base64,TEX' },
          dark: {},
        },
      };
      stripBookDataUrls(book);
      expect(book.appearance.light._idbCustomTexture).toBe(true);
      expect(book.appearance.light.customTextureData).toBeUndefined();
    });

    it('should handle book without optional fields', () => {
      const book = {};
      expect(() => stripBookDataUrls(book)).not.toThrow();
    });

    it('should handle book with null appearance themes', () => {
      const book = {
        appearance: { light: null, dark: null },
      };
      expect(() => stripBookDataUrls(book)).not.toThrow();
    });
  });
});
