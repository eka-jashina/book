/**
 * TESTS: FontController
 * Тесты для управления шрифтами: выбор, размер, загрузка кастомных шрифтов
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Мокаем зависимости перед импортом FontController
vi.mock('@/config.js', () => {
  const CONFIG = {
    FONTS: {
      georgia: 'Georgia, serif',
      inter: 'Inter, sans-serif',
      roboto: 'Roboto, sans-serif',
    },
    FONTS_LIST: [
      { id: 'georgia', label: 'Georgia' },
      { id: 'inter', label: 'Inter' },
    ],
    CUSTOM_FONTS: null,
    DECORATIVE_FONT: null,
  };
  return { CONFIG, getConfig: () => CONFIG };
});

vi.mock('@utils/index.js', () => ({
  cssVars: {
    invalidateCache: vi.fn(),
    getNumber: vi.fn((key, fallback) => {
      if (key === '--font-min') return 14;
      if (key === '--font-max') return 22;
      return fallback;
    }),
  },
  announce: vi.fn(),
  isValidFontSize: vi.fn((v) => typeof v === 'number' && !isNaN(v) && v >= 8 && v <= 72),
  sanitizeFontSize: vi.fn((v, def) => def),
}));

import { FontController } from '@core/delegates/FontController.js';
import { CONFIG } from '@/config.js';
import { cssVars, announce, isValidFontSize, sanitizeFontSize } from '@utils/index.js';

describe('FontController', () => {
  let controller;
  let mockDom;
  let mockSettings;
  let mockHtmlEl;

  beforeEach(() => {
    mockHtmlEl = document.createElement('div');

    mockDom = {
      get: vi.fn((key) => {
        if (key === 'html') return mockHtmlEl;
        if (key === 'fontSelect') return null;
        return null;
      }),
    };

    mockSettings = {
      get: vi.fn((key) => {
        if (key === 'font') return 'georgia';
        if (key === 'fontSize') return 18;
        return undefined;
      }),
      set: vi.fn(),
    };

    // Мок FontFace API (должен быть конструктором)
    global.FontFace = class MockFontFace {
      constructor(name, url) {
        this.family = name;
        this._url = url;
      }
      load() {
        return Promise.resolve(this);
      }
    };
    document.fonts = { add: vi.fn() };

    controller = new FontController({ dom: mockDom, settings: mockSettings });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should store dom and settings references', () => {
      expect(controller._dom).toBe(mockDom);
      expect(controller._settings).toBe(mockSettings);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // apply
  // ═══════════════════════════════════════════════════════════════════════════

  describe('apply', () => {
    it('should set font family CSS variable', () => {
      controller.apply();

      expect(mockHtmlEl.style.getPropertyValue('--reader-font-family')).toBe('Georgia, serif');
    });

    it('should set font size CSS variable', () => {
      controller.apply();

      expect(mockHtmlEl.style.getPropertyValue('--reader-font-size')).toBe('18px');
    });

    it('should use fallback font when font key not found', () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'font') return 'unknown-font';
        if (key === 'fontSize') return 18;
      });

      controller.apply();

      expect(mockHtmlEl.style.getPropertyValue('--reader-font-family')).toBe('Georgia, serif');
    });

    it('should handle invalid font size', () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'font') return 'georgia';
        if (key === 'fontSize') return NaN;
      });
      isValidFontSize.mockReturnValue(false);
      sanitizeFontSize.mockReturnValue(18);

      controller.apply();

      expect(mockHtmlEl.style.getPropertyValue('--reader-font-size')).toBe('18px');
    });

    it('should return early if html element not found', () => {
      mockDom.get.mockReturnValue(null);

      controller.apply(); // should not throw

      expect(mockHtmlEl.style.getPropertyValue('--reader-font-family')).toBe('');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // handleFont
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handleFont', () => {
    it('should set font family on html element', () => {
      controller.handleFont('inter');

      expect(mockHtmlEl.style.getPropertyValue('--reader-font-family')).toBe('Inter, sans-serif');
    });

    it('should invalidate CSS cache', () => {
      controller.handleFont('inter');

      expect(cssVars.invalidateCache).toHaveBeenCalled();
    });

    it('should announce font name', () => {
      controller.handleFont('inter');

      expect(announce).toHaveBeenCalledWith('Шрифт: Inter');
    });

    it('should announce raw key for unknown fonts', () => {
      controller.handleFont('custom-font');

      expect(announce).toHaveBeenCalledWith('Шрифт: custom-font');
    });

    it('should return true (requires repagination)', () => {
      expect(controller.handleFont('inter')).toBe(true);
    });

    it('should use fallback when font key not in CONFIG', () => {
      controller.handleFont('nonexistent');

      expect(mockHtmlEl.style.getPropertyValue('--reader-font-family')).toBe('Georgia, serif');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // handleFontSize
  // ═══════════════════════════════════════════════════════════════════════════

  describe('handleFontSize', () => {
    it('should increase font size', () => {
      controller.handleFontSize('increase');

      expect(mockSettings.set).toHaveBeenCalledWith('fontSize', 19);
      expect(mockHtmlEl.style.getPropertyValue('--reader-font-size')).toBe('19px');
    });

    it('should decrease font size', () => {
      controller.handleFontSize('decrease');

      expect(mockSettings.set).toHaveBeenCalledWith('fontSize', 17);
      expect(mockHtmlEl.style.getPropertyValue('--reader-font-size')).toBe('17px');
    });

    it('should not exceed max size', () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'fontSize') return 22;
        return undefined;
      });

      const result = controller.handleFontSize('increase');

      expect(result).toBe(false);
      expect(mockSettings.set).not.toHaveBeenCalled();
    });

    it('should not go below min size', () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'fontSize') return 14;
        return undefined;
      });

      const result = controller.handleFontSize('decrease');

      expect(result).toBe(false);
      expect(mockSettings.set).not.toHaveBeenCalled();
    });

    it('should return true when size changed', () => {
      expect(controller.handleFontSize('increase')).toBe(true);
    });

    it('should invalidate CSS cache on change', () => {
      controller.handleFontSize('increase');

      expect(cssVars.invalidateCache).toHaveBeenCalled();
    });

    it('should announce new size', () => {
      controller.handleFontSize('increase');

      expect(announce).toHaveBeenCalledWith('Размер шрифта: 19');
    });

    it('should handle unknown action', () => {
      const result = controller.handleFontSize('reset');

      expect(result).toBe(false);
      expect(mockSettings.set).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _loadCustomFonts
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_loadCustomFonts', () => {
    it('should load decorative font if configured', async () => {
      CONFIG.DECORATIVE_FONT = { dataUrl: 'data:font/woff2;base64,abc' };
      const addSpy = vi.spyOn(document.fonts, 'add');

      controller.apply();

      // Ждём промис _registerFont
      await vi.waitFor(() => {
        expect(addSpy).toHaveBeenCalled();
      });
    });

    it('should load custom reading fonts', async () => {
      CONFIG.CUSTOM_FONTS = [
        { id: 'custom1', dataUrl: 'data:font;base64,123', family: 'Custom, serif' },
      ];
      const addSpy = vi.spyOn(document.fonts, 'add');

      controller.apply();

      await vi.waitFor(() => {
        expect(addSpy).toHaveBeenCalled();
      });
    });

    it('should skip custom fonts without dataUrl', () => {
      CONFIG.CUSTOM_FONTS = [{ id: 'nofont', family: 'Sans' }];
      const addSpy = vi.spyOn(document.fonts, 'add');

      controller.apply();

      // FontFace не должен вызываться для шрифта без dataUrl (only decorative creates FontFace)
      expect(addSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _populateFontSelect
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_populateFontSelect', () => {
    it('should populate select with fonts from FONTS_LIST', () => {
      const mockSelect = document.createElement('select');
      mockDom.get.mockImplementation((key) => {
        if (key === 'html') return mockHtmlEl;
        if (key === 'fontSelect') return mockSelect;
        return null;
      });

      controller.apply();

      expect(mockSelect.querySelectorAll('option')).toHaveLength(2);
      expect(mockSelect.querySelector('option[value="georgia"]')).toBeTruthy();
    });

    it('should set current font as selected', () => {
      const mockSelect = document.createElement('select');
      mockDom.get.mockImplementation((key) => {
        if (key === 'html') return mockHtmlEl;
        if (key === 'fontSelect') return mockSelect;
        return null;
      });

      controller.apply();

      expect(mockSelect.value).toBe('georgia');
    });

    it('should select first font if current not in list', () => {
      const mockSelect = document.createElement('select');
      mockDom.get.mockImplementation((key) => {
        if (key === 'html') return mockHtmlEl;
        if (key === 'fontSelect') return mockSelect;
        return null;
      });
      mockSettings.get.mockImplementation((key) => {
        if (key === 'font') return 'nonexistent-font';
        if (key === 'fontSize') return 18;
      });

      controller.apply();

      expect(mockSelect.value).toBe('georgia');
      expect(mockSettings.set).toHaveBeenCalledWith('font', 'georgia');
    });

    it('should skip if FONTS_LIST is null', () => {
      CONFIG.FONTS_LIST = null;

      controller.apply(); // should not throw
    });

    it('should skip if fontSelect element not found', () => {
      controller.apply(); // mockDom returns null for fontSelect — should not throw
    });
  });

  describe('handleFontSize - edge cases', () => {
    it('should handle missing html element in handleFontSize', () => {
      mockDom.get.mockReturnValue(null);
      mockSettings.get.mockImplementation((key) => key === 'fontSize' ? 18 : undefined);

      // Should still work (return true) even without html element
      const result = controller.handleFontSize('increase');
      expect(result).toBe(true);
      expect(mockSettings.set).toHaveBeenCalledWith('fontSize', 19);
    });
  });

  describe('_registerFont - error handling', () => {
    it('should log warning when font fails to load', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      global.FontFace = class {
        constructor() {}
        load() { return Promise.reject(new Error('Failed to decode')); }
      };

      await controller._registerFont('TestFont', 'data:invalid');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('TestFont'),
        expect.any(String)
      );
      warnSpy.mockRestore();
    });
  });

  describe('_loadCustomFonts - decorative font', () => {
    it('should remove --decorative-font property when no decorative font configured', () => {
      CONFIG.DECORATIVE_FONT = null;
      CONFIG.CUSTOM_FONTS = null;

      controller.apply();

      expect(mockHtmlEl.style.getPropertyValue('--decorative-font')).toBe('');
    });

    it('should set --decorative-font when decorative font loads', async () => {
      CONFIG.DECORATIVE_FONT = { dataUrl: 'data:font/woff2;base64,test' };
      CONFIG.CUSTOM_FONTS = null;

      controller.apply();

      await vi.waitFor(() => {
        expect(mockHtmlEl.style.getPropertyValue('--decorative-font'))
          .toBe('CustomDecorativeFont, sans-serif');
      });
    });
  });

  describe('_loadCustomFonts - reading fonts', () => {
    it('should register custom font with id-based name', async () => {
      CONFIG.CUSTOM_FONTS = [
        { id: 'myfont', dataUrl: 'data:font;base64,abc', family: 'MyFont, serif' },
      ];
      CONFIG.DECORATIVE_FONT = null;

      controller.apply();

      await vi.waitFor(() => {
        // After registration, FONTS[id] should be updated
        expect(CONFIG.FONTS['myfont']).toContain('CustomReading_myfont');
      });
    });

    it('should use last segment of family as fallback', async () => {
      CONFIG.CUSTOM_FONTS = [
        { id: 'testfont', dataUrl: 'data:font;base64,abc', family: 'TestFont, Arial, sans-serif' },
      ];
      CONFIG.DECORATIVE_FONT = null;

      controller.apply();

      await vi.waitFor(() => {
        // family.split(',').pop().trim() = 'sans-serif'
        expect(CONFIG.FONTS['testfont']).toContain('sans-serif');
      });
    });
  });
});
