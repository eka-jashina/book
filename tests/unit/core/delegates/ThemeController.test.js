import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════
// МОКИ
// ═══════════════════════════════════════════

vi.mock('@i18n', () => ({ t: vi.fn((key, opts) => opts ? `${key}:${JSON.stringify(opts)}` : key) }));

vi.mock('@/config.js', () => ({ getConfig: vi.fn() }));

vi.mock('@utils/index.js', () => ({
  announce: vi.fn(),
  isValidTheme: vi.fn(t => ['light', 'dark', 'bw'].includes(t)),
  isValidCSSColor: vi.fn(() => true),
  isValidFontSize: vi.fn(() => true),
}));

vi.mock('@utils/Analytics.js', () => ({ trackThemeChanged: vi.fn() }));

vi.mock('@utils/GlobalThemeManager.js', () => ({
  setGlobalTheme: vi.fn(),
  getGlobalTheme: vi.fn(() => 'light'),
}));

import { getConfig } from '@/config.js';
import { announce, isValidTheme } from '@utils/index.js';
import { trackThemeChanged } from '@utils/Analytics.js';
import { setGlobalTheme, getGlobalTheme } from '@utils/GlobalThemeManager.js';
import { ThemeController } from '@core/delegates/ThemeController.js';

// ═══════════════════════════════════════════
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ═══════════════════════════════════════════

function createMockDom() {
  const html = document.documentElement;
  html.removeAttribute('data-theme');

  // Сегментированные кнопки тем (source uses .theme-segment with dataset.theme and dataset.active)
  const themeSegmented = document.createElement('div');
  ['light', 'dark', 'bw'].forEach(theme => {
    const seg = document.createElement('button');
    seg.dataset.theme = theme;
    seg.classList.add('theme-segment');
    seg.setAttribute('aria-checked', 'false');
    themeSegmented.appendChild(seg);
  });
  document.body.appendChild(themeSegmented);

  // Секции настроек (source uses data-setting, not data-setting-section)
  const settingSections = ['fontSize', 'theme', 'font', 'fullscreen', 'sound', 'ambient'].map(key => {
    const section = document.createElement('div');
    section.dataset.setting = key;
    document.body.appendChild(section);
    return section;
  });

  // The source uses this._dom.get("html"), this._dom.get("themeSegmented"), this._dom.get("cover")
  const domMap = {
    html,
    themeSegmented,
    cover: null,
  };

  return {
    get: vi.fn((key) => domMap[key] ?? null),
    html,
    themeSegmented,
    settingSections,
  };
}

function createMockSettings() {
  return {
    get: vi.fn(() => 'light'),
    set: vi.fn(),
    on: vi.fn(() => vi.fn()),
  };
}

function createDefaultConfig() {
  return {
    APPEARANCE: {
      light: {
        coverBgStart: '#3a2d1f',
        coverBgEnd: '#2a2016',
        coverText: '#f2e9d8',
        bgPage: '#fdfcf8',
        bgApp: '#e6e3dc',
      },
      dark: {
        coverBgStart: '#1a1a1a',
        coverBgEnd: '#0a0a0a',
        coverText: '#cccccc',
        bgPage: '#2a2a2a',
        bgApp: '#1a1a1a',
      },
      bw: {},
    },
    SETTINGS_VISIBILITY: {
      fontSize: true,
      theme: true,
      font: true,
      fullscreen: true,
      sound: false,
      ambient: false,
    },
    FONT_MIN: 14,
    FONT_MAX: 22,
  };
}

describe('ThemeController', () => {
  let controller;
  let dom;
  let settings;

  beforeEach(() => {
    document.body.innerHTML = '';
    dom = createMockDom();
    settings = createMockSettings();
    getConfig.mockReturnValue(createDefaultConfig());
    getGlobalTheme.mockReturnValue('light');
  });

  afterEach(() => {
    if (controller) {
      controller.destroy();
      controller = null;
    }
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════
  // КОНСТРУКТОР
  // ═══════════════════════════════════════════

  describe('constructor', () => {
    it('должен создать экземпляр с зависимостями', () => {
      controller = new ThemeController({ dom, settings });
      expect(controller).toBeDefined();
    });

    it('должен подписаться на событие flipbook:theme-changed', () => {
      const addSpy = vi.spyOn(document, 'addEventListener');
      controller = new ThemeController({ dom, settings });

      const themeCall = addSpy.mock.calls.find(c => c[0] === 'flipbook:theme-changed');
      expect(themeCall).toBeDefined();
      addSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД apply()
  // ═══════════════════════════════════════════

  describe('apply()', () => {
    beforeEach(() => {
      controller = new ThemeController({ dom, settings });
    });

    it('должен синхронизировать глобальную тему с настройками', () => {
      getGlobalTheme.mockReturnValue('dark');
      controller.apply();

      expect(settings.set).toHaveBeenCalledWith('theme', 'dark');
    });

    it('должен установить data-theme на html (empty for light)', () => {
      settings.get.mockReturnValue('light');
      controller.apply();

      // Source: html.dataset.theme = safeTheme === "light" ? "" : safeTheme
      expect(dom.html.dataset.theme).toBe('');
    });

    it('должен установить data-theme="dark" для тёмной темы', () => {
      getGlobalTheme.mockReturnValue('dark');
      settings.get.mockReturnValue('dark');
      controller.apply();

      expect(dom.html.dataset.theme).toBe('dark');
    });

    it('должен применить видимость настроек', () => {
      controller.apply();

      // sound и ambient скрыты согласно конфигу
      const soundSection = dom.settingSections.find(s => s.dataset.setting === 'sound');
      const ambientSection = dom.settingSections.find(s => s.dataset.setting === 'ambient');
      expect(soundSection.hidden).toBe(true);
      expect(ambientSection.hidden).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД handleTheme()
  // ═══════════════════════════════════════════

  describe('handleTheme()', () => {
    beforeEach(() => {
      controller = new ThemeController({ dom, settings });
    });

    it('должен установить тему при валидном значении', () => {
      controller.handleTheme('dark');

      expect(dom.html.dataset.theme).toBe('dark');
      expect(setGlobalTheme).toHaveBeenCalledWith('dark');
      expect(trackThemeChanged).toHaveBeenCalledWith('dark');
      expect(announce).toHaveBeenCalled();
    });

    it('должен использовать fallback "light" для невалидной темы', () => {
      isValidTheme.mockReturnValueOnce(false);
      controller.handleTheme('invalid-theme');

      // Falls back to "light", which sets dataset.theme = ""
      expect(setGlobalTheme).toHaveBeenCalledWith('light');
      expect(trackThemeChanged).toHaveBeenCalledWith('light');
    });

    it('должен обработать все валидные темы', () => {
      ['light', 'dark', 'bw'].forEach(theme => {
        vi.clearAllMocks();
        controller.handleTheme(theme);
        expect(setGlobalTheme).toHaveBeenCalledWith(theme);
      });
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _onGlobalThemeChanged()
  // ═══════════════════════════════════════════

  describe('_onGlobalThemeChanged()', () => {
    it('должен обработать внешнее событие смены темы', () => {
      controller = new ThemeController({ dom, settings });
      // Make current theme different from the event
      settings.get.mockReturnValue('light');

      const event = new CustomEvent('flipbook:theme-changed', {
        detail: { theme: 'dark' },
      });
      document.dispatchEvent(event);

      expect(settings.set).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _updateSegmentedUI()
  // ═══════════════════════════════════════════

  describe('_updateSegmentedUI()', () => {
    beforeEach(() => {
      controller = new ThemeController({ dom, settings });
    });

    it('должен пометить активный сегмент темы через apply()', () => {
      getGlobalTheme.mockReturnValue('dark');
      settings.get.mockReturnValue('dark');
      controller.apply();

      const segments = dom.themeSegmented.querySelectorAll('.theme-segment');
      const darkSeg = Array.from(segments).find(s => s.dataset.theme === 'dark');
      const lightSeg = Array.from(segments).find(s => s.dataset.theme === 'light');

      expect(darkSeg.dataset.active).toBe('true');
      expect(lightSeg.dataset.active).toBe('false');
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _applyAppearance()
  // ═══════════════════════════════════════════

  describe('_applyAppearance()', () => {
    it('должен применить CSS-переменные из конфига', () => {
      const config = createDefaultConfig();
      config.APPEARANCE.light.coverBgStart = '#ff0000';
      getConfig.mockReturnValue(config);

      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      // Контроллер должен применить appearance без ошибок
      expect(getConfig).toHaveBeenCalled();
    });

    it('должен корректно работать при отсутствии APPEARANCE', () => {
      getConfig.mockReturnValue({
        APPEARANCE: null,
        SETTINGS_VISIBILITY: {},
      });

      controller = new ThemeController({ dom, settings });
      expect(() => controller.apply()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД _applySettingsVisibility()
  // ═══════════════════════════════════════════

  describe('_applySettingsVisibility()', () => {
    it('должен скрыть секции с visibility=false', () => {
      controller = new ThemeController({ dom, settings });
      controller.apply();

      const soundSection = dom.settingSections.find(s => s.dataset.setting === 'sound');
      expect(soundSection.hidden).toBe(true);
    });

    it('должен показать секции с visibility=true', () => {
      controller = new ThemeController({ dom, settings });
      controller.apply();

      const fontSection = dom.settingSections.find(s => s.dataset.setting === 'fontSize');
      expect(fontSection.hidden).toBe(false);
    });

    it('должен работать при пустом SETTINGS_VISIBILITY', () => {
      getConfig.mockReturnValue({
        APPEARANCE: null,
        SETTINGS_VISIBILITY: null,
      });

      controller = new ThemeController({ dom, settings });
      expect(() => controller.apply()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // МЕТОД destroy()
  // ═══════════════════════════════════════════

  describe('destroy()', () => {
    it('должен удалить обработчик события', () => {
      const removeSpy = vi.spyOn(document, 'removeEventListener');
      controller = new ThemeController({ dom, settings });
      controller.destroy();

      const themeCall = removeSpy.mock.calls.find(c => c[0] === 'flipbook:theme-changed');
      expect(themeCall).toBeDefined();
      removeSpy.mockRestore();
    });

    it('должен обнулить ссылки', () => {
      controller = new ThemeController({ dom, settings });
      controller.destroy();

      // После destroy контроллер не должен реагировать на события
      expect(() => {
        const event = new CustomEvent('flipbook:theme-changed', {
          detail: { theme: 'dark' },
        });
        document.dispatchEvent(event);
      }).not.toThrow();

      controller = null;
    });
  });
});
