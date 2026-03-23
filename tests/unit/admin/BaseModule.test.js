/**
 * TESTS: BaseModule
 * Тесты для базового модуля админ-панели
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseModule } from '../../../js/admin/modules/BaseModule.js';

/**
 * Создать мок объекта app
 */
function createMockApp() {
  return {
    store: { getConfig: vi.fn(() => ({})) },
    _showToast: vi.fn(),
    _escapeHtml: vi.fn((str) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;')),
    _renderJsonPreview: vi.fn(),
  };
}

describe('BaseModule', () => {
  let app;
  let mod;

  beforeEach(() => {
    app = createMockApp();
    mod = new BaseModule(app);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should store app reference', () => {
      expect(mod.app).toBe(app);
    });

    it('should store store reference from app', () => {
      expect(mod.store).toBe(app.store);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DELEGATE METHODS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_showToast()', () => {
    it('should delegate to app._showToast', () => {
      mod._showToast('Test message');
      expect(app._showToast).toHaveBeenCalledWith('Test message');
    });
  });

  describe('_escapeHtml()', () => {
    it('should delegate to app._escapeHtml', () => {
      mod._escapeHtml('<script>');
      expect(app._escapeHtml).toHaveBeenCalledWith('<script>');
    });

    it('should return escaped result', () => {
      const result = mod._escapeHtml('<div>');
      expect(result).toBe('&lt;div&gt;');
    });
  });

  describe('_renderJsonPreview()', () => {
    it('should delegate to app._renderJsonPreview', () => {
      mod._renderJsonPreview();
      expect(app._renderJsonPreview).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _loadCustomFontPreview
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_loadCustomFontPreview()', () => {
    it('should create FontFace and load it', async () => {
      const mockFontFace = {
        load: vi.fn().mockResolvedValue({ family: 'TestFont' }),
      };
      global.FontFace = function(family, source) { return mockFontFace; };

      // Мок document.fonts
      const fontsSet = new Set();
      fontsSet.add = vi.fn();
      fontsSet.delete = vi.fn();
      Object.defineProperty(document, 'fonts', {
        value: fontsSet,
        configurable: true,
      });

      mod._loadCustomFontPreview('TestFont', 'data:font/woff2;base64,abc');

      expect(mockFontFace.load).toHaveBeenCalled();

      // Ждём промис
      await mockFontFace.load();
      expect(fontsSet.add).toHaveBeenCalled();

      delete global.FontFace;
    });

    it('should remove existing font with same family before loading', () => {
      const existingFont = { family: 'TestFont' };
      const fontsSet = new Set([existingFont]);
      const originalDelete = fontsSet.delete.bind(fontsSet);
      fontsSet.delete = vi.fn(originalDelete);
      Object.defineProperty(document, 'fonts', {
        value: fontsSet,
        configurable: true,
      });

      const mockFontFace = {
        load: vi.fn().mockResolvedValue({}),
      };
      global.FontFace = function(family, source) { return mockFontFace; };

      mod._loadCustomFontPreview('TestFont', 'data:abc');

      expect(fontsSet.delete).toHaveBeenCalledWith(existingFont);

      delete global.FontFace;
    });

    it('should show toast on font load error', async () => {
      const mockFontFace = {
        load: vi.fn().mockRejectedValue(new Error('load failed')),
      };
      global.FontFace = function(family, source) { return mockFontFace; };

      const fontsSet = new Set();
      Object.defineProperty(document, 'fonts', {
        value: fontsSet,
        configurable: true,
      });

      mod._loadCustomFontPreview('BadFont', 'data:bad');

      await vi.waitFor(() => {
        expect(app._showToast).toHaveBeenCalledWith('Ошибка загрузки шрифта');
      });

      delete global.FontFace;
    });
  });
});
