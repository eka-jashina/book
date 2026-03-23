/**
 * THEME CONTROLLER
 * Управление темами, оформлением и видимостью настроек.
 * Выделен из SettingsDelegate для снижения cyclomatic complexity.
 */

import { getConfig } from "../../config.js";
import { announce, isValidTheme, isValidCSSColor, isValidFontSize } from "../../utils/index.js";
import { trackThemeChanged } from "../../utils/Analytics.js";
import { setGlobalTheme, getGlobalTheme } from "../../utils/GlobalThemeManager.js";

/** Названия тем для объявления screen reader */
const THEME_NAMES = {
  light: 'Светлая тема',
  dark: 'Тёмная тема',
  bw: 'Чёрно-белая тема',
};

export class ThemeController {
  /**
   * @param {Object} deps
   * @param {Object} deps.dom - DOMManager
   * @param {Object} deps.settings - SettingsManager
   */
  constructor(deps) {
    this._dom = deps.dom;
    this._settings = deps.settings;
    this._boundOnGlobalThemeChanged = this._onGlobalThemeChanged.bind(this);
    document.addEventListener('flipbook:theme-changed', this._boundOnGlobalThemeChanged);
  }

  /**
   * Применить текущую тему к DOM.
   * Синхронизирует per-book тему с глобальной,
   * чтобы тема, выбранная на лендинге/полке, применялась и в ридере.
   */
  apply() {
    const html = this._dom.get("html");
    if (!html) return;

    // Берём глобальную тему как source of truth:
    // если пользователь сменил тему на лендинге/полке,
    // при открытии книги используем именно эту тему.
    const globalTheme = getGlobalTheme();
    if (isValidTheme(globalTheme)) {
      this._settings.set("theme", globalTheme);
    }

    const theme = this._settings.get("theme");
    const safeTheme = isValidTheme(theme) ? theme : "light";
    html.dataset.theme = safeTheme === "light" ? "" : safeTheme;

    this._updateSegmentedUI(safeTheme);
    this._applyAppearance();
    this._applySettingsVisibility();
  }

  /**
   * Обработать изменение темы (из UI ридера — segmented control)
   * @param {string} theme
   */
  handleTheme(theme) {
    // Валидация: допускать только известные темы
    const safeTheme = isValidTheme(theme) ? theme : "light";

    const html = this._dom.get("html");
    if (html) {
      html.dataset.theme = safeTheme === "light" ? "" : safeTheme;
    }

    this._applyAppearance();
    setGlobalTheme(safeTheme);
    trackThemeChanged(safeTheme);
    announce(THEME_NAMES[safeTheme] || safeTheme);
  }

  /**
   * Реакция на внешнее изменение глобальной темы
   * (например, ThemeToggle на лендинге/полке/аккаунте).
   * Синхронизирует per-book настройки и UI ридера.
   * @private
   * @param {CustomEvent} e
   */
  _onGlobalThemeChanged(e) {
    if (!this._settings || !this._dom) return;

    const newTheme = e.detail?.theme;
    if (!newTheme || !isValidTheme(newTheme)) return;

    const currentTheme = this._settings.get("theme");
    if (currentTheme === newTheme) return;

    // Обновить per-book настройку
    this._settings.set("theme", newTheme);

    // Обновить segmented control в настройках ридера
    this._updateSegmentedUI(newTheme);

    // Применить оформление (cover colors, page textures и т.д.)
    this._applyAppearance();
  }

  /**
   * Обновить активный сегмент в theme segmented control.
   * @private
   * @param {string} theme
   */
  _updateSegmentedUI(theme) {
    const themeSegmented = this._dom.get("themeSegmented");
    if (!themeSegmented) return;

    const segments = themeSegmented.querySelectorAll('.theme-segment');
    segments.forEach(s => {
      const isActive = s.dataset.theme === theme;
      s.dataset.active = isActive;
      s.setAttribute('aria-checked', isActive);
    });
  }

  /**
   * Освободить ресурсы
   */
  destroy() {
    document.removeEventListener('flipbook:theme-changed', this._boundOnGlobalThemeChanged);
    this._dom = null;
    this._settings = null;
  }

  // ═══════════════════════════════════════════
  // ОФОРМЛЕНИЕ ИЗ АДМИНКИ
  // ═══════════════════════════════════════════

  /**
   * Применить настройки оформления из CONFIG.APPEARANCE к CSS-переменным.
   * @private
   */
  _applyAppearance() {
    const html = this._dom.get("html");
    if (!html) return;

    const a = getConfig().APPEARANCE;
    if (!a) return;

    const cover = this._dom.get("cover");
    if (cover) {
      const spans = cover.querySelectorAll(".cover-front h1 span");
      if (spans.length >= 2) {
        spans[0].textContent = a.coverTitle;
        spans[1].textContent = a.coverAuthor;
      }
    }

    const currentTheme = this._settings.get("theme");

    // ЧБ тема: убираем inline-переопределения, чтобы CSS-переменные из themes.css работали
    if (currentTheme === "bw") {
      html.style.removeProperty("--cover-front-bg");
      html.style.removeProperty("--cover-front-text");
      html.style.removeProperty("--bg-page");
      html.style.removeProperty("--bg-book");
      html.style.removeProperty("--bg-app");
      html.style.removeProperty("--bg-page-image");
      document.body.style.backgroundColor = '';
    } else {
      const themeKey = currentTheme === "dark" ? "dark" : "light";
      const t = a[themeKey] || a.light;

      if (t.coverBgImage) {
        html.style.setProperty("--cover-front-bg", `url(${t.coverBgImage})`);
      } else {
        // Валидация цветов обложки перед формированием gradient
        const start = isValidCSSColor(t.coverBgStart) ? t.coverBgStart : '#3a2d1f';
        const end = isValidCSSColor(t.coverBgEnd) ? t.coverBgEnd : '#2a2016';
        html.style.setProperty("--cover-front-bg", `linear-gradient(135deg, ${start}, ${end})`);
      }

      // Валидация цвета текста обложки
      const coverText = isValidCSSColor(t.coverText) ? t.coverText : '#f2e9d8';
      html.style.setProperty("--cover-front-text", coverText);

      if (t.pageTexture === "custom" && t.customTextureData) {
        html.style.setProperty("--bg-page-image", `url(${t.customTextureData})`);
      } else if (t.pageTexture === "none") {
        html.style.setProperty("--bg-page-image", "none");
      } else {
        html.style.removeProperty("--bg-page-image");
      }

      // Валидация цветов фона страницы и приложения
      const bgPage = isValidCSSColor(t.bgPage) ? t.bgPage : '#fdfcf8';
      const bgApp = isValidCSSColor(t.bgApp) ? t.bgApp : '#e6e3dc';
      html.style.setProperty("--bg-page", bgPage);
      html.style.setProperty("--bg-book", bgPage);
      html.style.setProperty("--bg-app", bgApp);
      // Явно задаём фон body, чтобы обойти проблему
      // наследования CSS custom properties + transitions при SPA-навигации:
      // изменение var через inline style на html не всегда вызывает
      // пересчёт background-color у body, если на body есть transition.
      document.body.style.backgroundColor = bgApp;
    }

    // Валидация границ размера шрифта
    const fontMin = isValidFontSize(a.fontMin) ? a.fontMin : 14;
    const fontMax = isValidFontSize(a.fontMax) ? a.fontMax : 22;
    html.style.setProperty("--font-min", `${fontMin}px`);
    html.style.setProperty("--font-max", `${fontMax}px`);
  }

  // ═══════════════════════════════════════════
  // ВИДИМОСТЬ НАСТРОЕК
  // ═══════════════════════════════════════════

  /**
   * Скрыть/показать секции пользовательских настроек по конфигу из админки.
   * @private
   */
  _applySettingsVisibility() {
    const v = getConfig().SETTINGS_VISIBILITY;
    if (!v) return;

    const sections = document.querySelectorAll('[data-setting]');
    sections.forEach(section => {
      const key = section.dataset.setting;
      if (key in v) {
        section.hidden = !v[key];
      }
    });

    const settingsPod = document.querySelector('.settings-pod');
    if (settingsPod) {
      const visibleSections = settingsPod.querySelectorAll('.settings-section:not([hidden])');
      settingsPod.hidden = visibleSections.length === 0;
    }

    const audioPod = document.querySelector('.audio-pod');
    if (audioPod) {
      const visibleSections = audioPod.querySelectorAll('.audio-section:not([hidden])');
      audioPod.hidden = visibleSections.length === 0;
    }
  }
}
