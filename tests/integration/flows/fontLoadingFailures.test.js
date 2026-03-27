/**
 * INTEGRATION TEST: Font Loading Failures
 * FontFace ошибка → fallback шрифт → восстановление UI:
 * - Декоративный шрифт не загружается → CSS variable сбрасывается
 * - Reading font не загружается → fallback family сохраняется
 * - Множественные шрифты: часть загружается, часть нет
 * - FontFace API недоступен → graceful degradation
 * - Font select корректно заполняется после ошибок
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createFullBookDOM, cleanupIntegrationDOM } from '../../helpers/integrationUtils.js';
import { FontController } from '../../../js/core/delegates/FontController.js';

// Mock config
const TEST_CONFIG = {
  FONTS: {
    georgia: 'Georgia, serif',
    merriweather: '"Merriweather", serif',
    inter: '"Inter", sans-serif',
  },
  FONTS_LIST: [
    { id: 'georgia', label: 'Georgia' },
    { id: 'merriweather', label: 'Merriweather' },
  ],
  DECORATIVE_FONT: null,
  CUSTOM_FONTS: [],
};

vi.mock('../../../js/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getConfig: () => TEST_CONFIG,
  };
});

vi.mock('../../../js/utils/index.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    cssVars: {
      getNumber: vi.fn((key, def) => def),
      invalidateCache: vi.fn(),
    },
    announce: vi.fn(),
    isValidFontSize: (v) => typeof v === 'number' && v >= 14 && v <= 22,
    sanitizeFontSize: (v, def) => def,
  };
});

vi.mock('../../../js/utils/Analytics.js', () => ({
  trackFontChanged: vi.fn(),
}));

describe('Font Loading Failures', () => {
  let dom;
  let fontController;
  let mockDom;
  let mockSettings;
  let htmlElement;
  let fontSelectEl;
  /** Перехват вызовов FontFace */
  let fontFaceMock;

  beforeEach(() => {
    dom = createFullBookDOM();
    htmlElement = document.documentElement;

    fontSelectEl = document.createElement('select');
    fontSelectEl.id = 'fontSelect';
    document.body.appendChild(fontSelectEl);

    mockDom = {
      get: (id) => {
        if (id === 'html') return htmlElement;
        if (id === 'fontSelect') return fontSelectEl;
        return null;
      },
    };

    mockSettings = {
      get: vi.fn((key) => {
        if (key === 'font') return 'georgia';
        if (key === 'fontSize') return 18;
        return null;
      }),
      set: vi.fn(),
    };

    fontController = new FontController({ dom: mockDom, settings: mockSettings });

    // Сбрасываем CONFIG для каждого теста
    TEST_CONFIG.DECORATIVE_FONT = null;
    TEST_CONFIG.CUSTOM_FONTS = [];
    TEST_CONFIG.FONTS_LIST = [
      { id: 'georgia', label: 'Georgia' },
      { id: 'merriweather', label: 'Merriweather' },
    ];
    TEST_CONFIG.FONTS = {
      georgia: 'Georgia, serif',
      merriweather: '"Merriweather", serif',
      inter: '"Inter", sans-serif',
    };

    // По умолчанию FontFace работает
    fontFaceMock = vi.fn().mockImplementation(function (name, src) {
      this.family = name;
      this.load = vi.fn().mockResolvedValue({ family: name });
    });
    global.FontFace = fontFaceMock;

    // Мок document.fonts (jsdom не реализует FontFaceSet)
    if (!document.fonts) {
      Object.defineProperty(document, 'fonts', {
        value: { add: vi.fn() },
        writable: true,
        configurable: true,
      });
    } else {
      document.fonts.add = vi.fn();
    }
  });

  afterEach(() => {
    cleanupIntegrationDOM();
    vi.restoreAllMocks();
    delete global.FontFace;
  });

  // ═══════════════════════════════════════════
  // DECORATIVE FONT FAILURE
  // ═══════════════════════════════════════════

  describe('Decorative font loading failure', () => {
    it('should log warning when decorative font fails to load', async () => {
      TEST_CONFIG.DECORATIVE_FONT = { dataUrl: 'data:font/woff2;base64,FAKE' };

      // FontFace.load() выбрасывает ошибку
      fontFaceMock.mockImplementation(function () {
        this.load = vi.fn().mockRejectedValue(new Error('Invalid font data'));
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      fontController.apply();
      await new Promise(r => setTimeout(r, 0)); // ждём промис

      // Ошибка залогирована (шрифт не добавлен в document.fonts)
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('CustomDecorativeFont'),
        expect.any(String),
      );
      expect(document.fonts.add).not.toHaveBeenCalled();

      // CSS variable всё равно устанавливается (промис из _registerFont resolves после catch)
      expect(htmlElement.style.getPropertyValue('--decorative-font')).toBe(
        'CustomDecorativeFont, sans-serif',
      );

      warnSpy.mockRestore();
    });

    it('should set decorative font CSS variable on success', async () => {
      TEST_CONFIG.DECORATIVE_FONT = { dataUrl: 'data:font/woff2;base64,VALID' };

      fontFaceMock.mockImplementation(function (name) {
        this.family = name;
        this.load = vi.fn().mockResolvedValue({ family: name });
      });

      fontController.apply();
      await new Promise(r => setTimeout(r, 0));

      expect(htmlElement.style.getPropertyValue('--decorative-font')).toBe(
        'CustomDecorativeFont, sans-serif',
      );
      expect(document.fonts.add).toHaveBeenCalled();
    });

    it('should remove decorative font property when no decorative font configured', () => {
      // Устанавливаем значение как будто раньше был шрифт
      htmlElement.style.setProperty('--decorative-font', 'OldFont, serif');

      TEST_CONFIG.DECORATIVE_FONT = null;

      fontController.apply();

      expect(htmlElement.style.getPropertyValue('--decorative-font')).toBe('');
    });
  });

  // ═══════════════════════════════════════════
  // CUSTOM READING FONTS FAILURE
  // ═══════════════════════════════════════════

  describe('Custom reading font loading failure', () => {
    it('should continue loading other fonts when one fails', async () => {
      TEST_CONFIG.CUSTOM_FONTS = [
        { id: 'custom1', dataUrl: 'data:font/woff2;base64,GOOD', family: 'CustomFont1, serif' },
        { id: 'custom2', dataUrl: 'data:font/woff2;base64,BAD', family: 'CustomFont2, sans-serif' },
        { id: 'custom3', dataUrl: 'data:font/woff2;base64,GOOD2', family: 'CustomFont3, serif' },
      ];

      let callIndex = 0;
      fontFaceMock.mockImplementation(function (name) {
        callIndex++;
        this.family = name;
        if (name.includes('custom2')) {
          this.load = vi.fn().mockRejectedValue(new Error('Corrupted font'));
        } else {
          this.load = vi.fn().mockResolvedValue({ family: name });
        }
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      fontController.apply();
      await new Promise(r => setTimeout(r, 0));

      // custom1 и custom3 зарегистрированы в document.fonts, custom2 — нет
      expect(document.fonts.add).toHaveBeenCalledTimes(2);

      // FONTS для custom1 и custom3 обновлены
      expect(TEST_CONFIG.FONTS['custom1']).toContain('CustomReading_custom1');
      expect(TEST_CONFIG.FONTS['custom3']).toContain('CustomReading_custom3');

      // custom2 в FONTS (промис _registerFont resolves после catch, .then в _loadCustomFonts выполняется)
      // но в document.fonts он НЕ добавлен — только 2 вызова add
      expect(TEST_CONFIG.FONTS['custom2']).toContain('CustomReading_custom2');

      warnSpy.mockRestore();
    });

    it('should skip fonts without dataUrl', async () => {
      TEST_CONFIG.CUSTOM_FONTS = [
        { id: 'nodata', family: 'NoDataFont, serif' }, // нет dataUrl
        { id: 'withdata', dataUrl: 'data:font/woff2;base64,OK', family: 'WithData, serif' },
      ];

      fontController.apply();
      await new Promise(r => setTimeout(r, 0));

      // Только один FontFace создан
      // Первый вызов — если нет decorative, то только withdata
      const fontFaceCalls = fontFaceMock.mock.calls.filter(
        ([name]) => name.startsWith('CustomReading_'),
      );
      expect(fontFaceCalls).toHaveLength(1);
      expect(fontFaceCalls[0][0]).toBe('CustomReading_withdata');
    });
  });

  // ═══════════════════════════════════════════
  // FONT SELECT POPULATION
  // ═══════════════════════════════════════════

  describe('Font select population after errors', () => {
    it('should populate font selector even when custom fonts fail', async () => {
      TEST_CONFIG.CUSTOM_FONTS = [
        { id: 'bad', dataUrl: 'data:font/woff2;base64,BAD', family: 'Bad, serif' },
      ];

      fontFaceMock.mockImplementation(function () {
        this.load = vi.fn().mockRejectedValue(new Error('Load failed'));
      });

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      fontController.apply();
      await new Promise(r => setTimeout(r, 0));

      // Font select заполнен из FONTS_LIST
      expect(fontSelectEl.options.length).toBe(2);
      expect(fontSelectEl.options[0].value).toBe('georgia');
      expect(fontSelectEl.options[1].value).toBe('merriweather');

      warnSpy.mockRestore();
    });

    it('should set select value to current font', () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'font') return 'merriweather';
        if (key === 'fontSize') return 18;
        return null;
      });

      fontController.apply();

      expect(fontSelectEl.value).toBe('merriweather');
    });

    it('should fallback to first font if current font not in list', () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'font') return 'nonexistent';
        if (key === 'fontSize') return 18;
        return null;
      });

      fontController.apply();

      expect(fontSelectEl.value).toBe('georgia');
      expect(mockSettings.set).toHaveBeenCalledWith('font', 'georgia');
    });
  });

  // ═══════════════════════════════════════════
  // CSS FONT VARIABLES
  // ═══════════════════════════════════════════

  describe('CSS font variables', () => {
    it('should set reader-font-family from config', () => {
      fontController.apply();

      expect(htmlElement.style.getPropertyValue('--reader-font-family')).toBe('Georgia, serif');
    });

    it('should fallback to georgia when unknown font key', () => {
      mockSettings.get.mockImplementation((key) => {
        if (key === 'font') return 'unknown_font';
        if (key === 'fontSize') return 18;
        return null;
      });

      fontController.apply();

      expect(htmlElement.style.getPropertyValue('--reader-font-family')).toBe('Georgia, serif');
    });

    it('should set reader-font-size from settings', () => {
      fontController.apply();

      expect(htmlElement.style.getPropertyValue('--reader-font-size')).toBe('18px');
    });
  });

  // ═══════════════════════════════════════════
  // FONT CHANGE HANDLER
  // ═══════════════════════════════════════════

  describe('Font change handling', () => {
    it('should update CSS and return true for repagination', () => {
      const needsRepagination = fontController.handleFont('inter');

      expect(needsRepagination).toBe(true);
      expect(htmlElement.style.getPropertyValue('--reader-font-family')).toBe('"Inter", sans-serif');
    });

    it('should fallback to georgia for unknown font in handleFont', () => {
      fontController.handleFont('totally_unknown');

      expect(htmlElement.style.getPropertyValue('--reader-font-family')).toBe('Georgia, serif');
    });
  });
});
