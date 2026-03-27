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
      expect(announce).toHaveBeenCalledWith('Тёмная тема');
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

    it('должен обнулить _dom и _settings', () => {
      controller = new ThemeController({ dom, settings });
      controller.destroy();

      expect(controller._dom).toBeNull();
      expect(controller._settings).toBeNull();
      controller = null;
    });
  });

  describe('_onGlobalThemeChanged - guard conditions', () => {
    it('should ignore event with missing detail', () => {
      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');

      const event = new CustomEvent('flipbook:theme-changed', { detail: null });
      document.dispatchEvent(event);

      // settings.set should not be called (guard: !newTheme)
      expect(settings.set).not.toHaveBeenCalled();
    });

    it('should ignore event with invalid theme', () => {
      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');

      isValidTheme.mockReturnValueOnce(false);
      const event = new CustomEvent('flipbook:theme-changed', {
        detail: { theme: 'invalid' },
      });
      document.dispatchEvent(event);

      expect(settings.set).not.toHaveBeenCalled();
    });

    it('should ignore event when theme is same as current', () => {
      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('dark');

      const event = new CustomEvent('flipbook:theme-changed', {
        detail: { theme: 'dark' },
      });
      document.dispatchEvent(event);

      expect(settings.set).not.toHaveBeenCalled();
    });

    it('should ignore event after destroy (null settings/dom)', () => {
      controller = new ThemeController({ dom, settings });
      controller.destroy();

      // Even though we removed the listener, test the guard
      controller._onGlobalThemeChanged(new CustomEvent('test', { detail: { theme: 'dark' } }));
      // Should not throw
      controller = null;
    });
  });

  describe('_updateSegmentedUI - aria-checked', () => {
    it('should set aria-checked="true" on active segment', () => {
      controller = new ThemeController({ dom, settings });
      getGlobalTheme.mockReturnValue('dark');
      settings.get.mockReturnValue('dark');
      controller.apply();

      const segments = dom.themeSegmented.querySelectorAll('.theme-segment');
      const darkSeg = Array.from(segments).find(s => s.dataset.theme === 'dark');
      expect(darkSeg.getAttribute('aria-checked')).toBe('true');
    });

    it('should set aria-checked="false" on inactive segments', () => {
      controller = new ThemeController({ dom, settings });
      getGlobalTheme.mockReturnValue('dark');
      settings.get.mockReturnValue('dark');
      controller.apply();

      const segments = dom.themeSegmented.querySelectorAll('.theme-segment');
      const lightSeg = Array.from(segments).find(s => s.dataset.theme === 'light');
      const bwSeg = Array.from(segments).find(s => s.dataset.theme === 'bw');
      expect(lightSeg.getAttribute('aria-checked')).toBe('false');
      expect(bwSeg.getAttribute('aria-checked')).toBe('false');
    });
  });

  describe('handleTheme - announce THEME_NAMES', () => {
    it('should announce raw theme name for unknown theme', () => {
      controller = new ThemeController({ dom, settings });
      isValidTheme.mockReturnValue(true);
      controller.handleTheme('custom-theme');
      expect(announce).toHaveBeenCalledWith('custom-theme');
    });
  });

  describe('_applyAppearance - bw theme removes properties', () => {
    it('should removeProperty for bw theme CSS vars', () => {
      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('bw');
      controller.apply();

      expect(dom.html.style.getPropertyValue('--cover-front-bg')).toBe('');
      expect(dom.html.style.getPropertyValue('--cover-front-text')).toBe('');
    });

    it('should set body backgroundColor to empty for bw theme', () => {
      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('bw');
      controller.apply();

      expect(document.body.style.backgroundColor).toBe('');
    });
  });

  describe('_applyAppearance - cover gradient', () => {
    it('should set gradient when no coverBgImage', () => {
      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      const bgValue = dom.html.style.getPropertyValue('--cover-front-bg');
      expect(bgValue).toContain('linear-gradient');
      expect(bgValue).toContain('135deg');
    });

    it('should set coverBgImage url when available', () => {
      const config = createDefaultConfig();
      config.APPEARANCE.light.coverBgImage = 'images/cover.jpg';
      getConfig.mockReturnValue(config);

      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      const bgValue = dom.html.style.getPropertyValue('--cover-front-bg');
      expect(bgValue).toContain('url(');
      expect(bgValue).toContain('images/cover.jpg');
    });
  });

  describe('_applyAppearance - pageTexture', () => {
    it('should set "none" for pageTexture="none"', () => {
      const config = createDefaultConfig();
      config.APPEARANCE.light.pageTexture = 'none';
      getConfig.mockReturnValue(config);

      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      expect(dom.html.style.getPropertyValue('--bg-page-image')).toBe('none');
    });

    it('should set custom texture url for pageTexture="custom"', () => {
      const config = createDefaultConfig();
      config.APPEARANCE.light.pageTexture = 'custom';
      config.APPEARANCE.light.customTextureData = 'data:image/png;base64,abc';
      getConfig.mockReturnValue(config);

      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      expect(dom.html.style.getPropertyValue('--bg-page-image')).toContain('url(');
    });

    it('should remove --bg-page-image for default texture', () => {
      const config = createDefaultConfig();
      config.APPEARANCE.light.pageTexture = undefined;
      getConfig.mockReturnValue(config);

      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      // removeProperty was called, so value should be empty
      expect(dom.html.style.getPropertyValue('--bg-page-image')).toBe('');
    });
  });

  describe('_applyAppearance - dark themeKey', () => {
    it('should use "dark" sub-object for dark theme', () => {
      const config = createDefaultConfig();
      config.APPEARANCE.dark.bgPage = '#222222';
      config.APPEARANCE.dark.bgApp = '#111111';
      getConfig.mockReturnValue(config);

      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('dark');
      controller.apply();

      expect(dom.html.style.getPropertyValue('--bg-page')).toBe('#222222');
      expect(dom.html.style.getPropertyValue('--bg-app')).toBe('#111111');
    });

    it('should use "light" as default for non-bw non-dark themes', () => {
      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      const config = createDefaultConfig();
      expect(dom.html.style.getPropertyValue('--bg-page')).toBe(config.APPEARANCE.light.bgPage);
    });
  });

  describe('_applyAppearance - font limits', () => {
    it('should set --font-min CSS variable', () => {
      const config = createDefaultConfig();
      config.APPEARANCE.fontMin = 12;
      config.APPEARANCE.fontMax = 28;
      getConfig.mockReturnValue(config);

      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      expect(dom.html.style.getPropertyValue('--font-min')).toBe('12px');
      expect(dom.html.style.getPropertyValue('--font-max')).toBe('28px');
    });
  });

  describe('_applyAppearance - body backgroundColor', () => {
    it('should set document.body.style.backgroundColor to bgApp', () => {
      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      // jsdom normalizes hex to rgb
      expect(document.body.style.backgroundColor).toBe('rgb(230, 227, 220)');
    });
  });

  describe('_applyAppearance - cover title/author', () => {
    it('should set cover title and author text', () => {
      const config = createDefaultConfig();
      config.APPEARANCE.coverTitle = 'Test Title';
      config.APPEARANCE.coverAuthor = 'Test Author';
      getConfig.mockReturnValue(config);

      const coverEl = document.createElement('div');
      const h1 = document.createElement('h1');
      h1.classList.add('cover-front');
      const span1 = document.createElement('span');
      const span2 = document.createElement('span');
      h1.appendChild(span1);
      h1.appendChild(span2);
      const coverFront = document.createElement('div');
      coverFront.classList.add('cover-front');
      coverFront.appendChild(h1);
      coverEl.appendChild(coverFront);

      dom.get.mockImplementation((key) => {
        if (key === 'html') return dom.html;
        if (key === 'cover') return coverEl;
        if (key === 'themeSegmented') return dom.themeSegmented;
        return null;
      });

      controller = new ThemeController({ dom, settings });
      settings.get.mockReturnValue('light');
      controller.apply();

      expect(span1.textContent).toBe('Test Title');
      expect(span2.textContent).toBe('Test Author');
    });
  });

  describe('_applySettingsVisibility - audioPod', () => {
    it('should hide audio-pod when all audio sections are hidden', () => {
      const audioPod = document.createElement('div');
      audioPod.classList.add('audio-pod');

      // Add audio sections that are all hidden
      const soundSection = document.createElement('div');
      soundSection.classList.add('audio-section');
      soundSection.dataset.setting = 'sound';
      soundSection.hidden = true;
      audioPod.appendChild(soundSection);

      const ambientSection = document.createElement('div');
      ambientSection.classList.add('audio-section');
      ambientSection.dataset.setting = 'ambient';
      ambientSection.hidden = true;
      audioPod.appendChild(ambientSection);

      document.body.appendChild(audioPod);

      controller = new ThemeController({ dom, settings });
      controller.apply();

      expect(audioPod.hidden).toBe(true);
    });
  });

  describe('apply - globalTheme not valid', () => {
    it('should not sync global theme if invalid', () => {
      getGlobalTheme.mockReturnValue('invalid-theme');
      isValidTheme.mockImplementation(t => ['light', 'dark', 'bw'].includes(t));

      controller = new ThemeController({ dom, settings });
      controller.apply();

      // settings.set should not be called with invalid theme
      expect(settings.set).not.toHaveBeenCalledWith('theme', 'invalid-theme');
    });
  });
});
