/**
 * SETTINGS DELEGATE - REFACTORED
 * Управление применением и изменением настроек.
 *
 * Делегирует ответственность контроллерам:
 * - FontController: шрифты, размер шрифта, загрузка кастомных шрифтов
 * - AudioController: звуки, громкость, ambient
 * - ThemeController: темы, оформление, видимость настроек
 */

import { cssVars } from "../../utils/index.js";
import { BaseDelegate, DelegateEvents } from './BaseDelegate.js';
import { FontController } from './FontController.js';
import { AudioController } from './AudioController.js';
import { ThemeController } from './ThemeController.js';
import { t, setLanguage, applyTranslations } from '@i18n';
import { StorageManager } from '@utils/StorageManager.js';
import { trackSettingsChanged } from '../../utils/Analytics.js';

const languageStorage = new StorageManager('flipbook-language');

export class SettingsDelegate extends BaseDelegate {
  /**
   * @param {Object} deps
   * @param {DOMManager} deps.dom
   * @param {SettingsManager} deps.settings
   * @param {SoundManager} deps.soundManager
   * @param {AmbientManager} deps.ambientManager
   * @param {DebugPanel} deps.debugPanel
   */
  constructor(deps) {
    super(deps);
    this.debugPanel = deps.debugPanel;

    this._fontController = new FontController({
      dom: this.dom,
      settings: this.settings,
    });

    this._audioController = new AudioController({
      settings: this.settings,
      soundManager: this.soundManager,
      ambientManager: this.ambientManager,
    });

    this._themeController = new ThemeController({
      dom: this.dom,
      settings: this.settings,
    });
  }

  /**
   * Валидация зависимостей
   * @protected
   */
  _validateRequiredDependencies(deps) {
    this._validateDependencies(
      deps,
      ['dom', 'settings'],
      'SettingsDelegate'
    );
  }

  /**
   * Применить все настройки к DOM
   */
  apply() {
    const html = this.dom.get("html");
    if (!html) {
      console.error("SettingsDelegate: HTML element not found");
      return;
    }

    this._fontController.apply();
    this._themeController.apply();
    this._audioController.apply();

    cssVars.invalidateCache();
  }

  /**
   * Обработать изменение настройки
   * @param {string} key
   * @param {*} value
   */
  handleChange(key, value) {
    // Для action-параметров (increase/decrease) не сохраняем напрямую —
    // обработчики сами вычислят и сохранят новое значение
    const isActionValue = value === "increase" || value === "decrease";
    if (!isActionValue) {
      this.settings.set(key, value);
    }

    switch (key) {
      case "fontSize":
        if (this._fontController.handleFontSize(value) && this.isOpened) {
          this.emit(DelegateEvents.REPAGINATE, true);
        }
        break;
      case "font":
        if (this._fontController.handleFont(value) && this.isOpened) {
          this.emit(DelegateEvents.REPAGINATE, true);
        }
        break;
      case "theme":
        this._themeController.handleTheme(value);
        break;
      case "soundEnabled":
        this._audioController.handleSoundToggle(value);
        break;
      case "soundVolume":
        this._audioController.handleSoundVolume(value);
        break;
      case "debug":
        this._handleDebug();
        break;
      case "ambientType":
        this._audioController.handleAmbientType(value);
        break;
      case "ambientVolume":
        this._audioController.handleAmbientVolume(value);
        break;
      case "fullscreen":
        this._handleFullscreen();
        break;
      case "language":
        this._handleLanguage(value);
        break;
    }

    // Аналитика
    trackSettingsChanged(key, String(value));

    // Уведомляем контроллер об обновлении
    this.emit(DelegateEvents.SETTINGS_UPDATE);
  }

  /**
   * Обработать переключение отладки
   * @private
   */
  _handleDebug() {
    if (this.debugPanel) {
      this.debugPanel.toggle();
    }
  }

  /**
   * Обработать смену языка интерфейса
   * @private
   * @param {string} code - Код языка (ru, en, es, fr, de)
   */
  async _handleLanguage(code) {
    await setLanguage(code);
    // Сохраняем выбранный язык отдельно (не зависит от книги)
    languageStorage.setRaw(code);
    applyTranslations();
    this._updateAmbientPillLabels();
  }

  /**
   * Обновить лейблы ambient pills после смены языка.
   * Встроенные амбиенты (rain, fireplace, cafe и др.) используют i18n-ключи.
   * @private
   */
  _updateAmbientPillLabels() {
    const container = this.dom.get('ambientPills');
    if (!container) return;

    for (const pill of container.querySelectorAll('.ambient-pill')) {
      const type = pill.dataset.type;
      const i18nLabel = t(`ambient.${type}`, { defaultValue: '' });
      const i18nShort = t(`ambient.${type}Short`, { defaultValue: '' });
      if (i18nLabel) {
        pill.setAttribute('aria-label', i18nLabel);
        pill.querySelector('.ambient-pill-label').textContent = i18nShort || i18nLabel;
      }
    }
  }

  /**
   * Переключить полноэкранный режим
   * @private
   */
  _handleFullscreen() {
    const el = document.documentElement;
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

    if (!isFullscreen) {
      const request = el.requestFullscreen || el.webkitRequestFullscreen;
      if (request) {
        request.call(el).catch((err) => {
          console.warn("Не удалось войти в полноэкранный режим:", err.message);
        });
      }
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (exit) {
        exit.call(document).catch((err) => {
          console.warn("Не удалось выйти из полноэкранного режима:", err.message);
        });
      }
    }
  }

  /**
   * Очистка
   */
  destroy() {
    this.debugPanel = null;
    this._fontController = null;
    this._audioController = null;
    if (this._themeController) {
      this._themeController.destroy();
      this._themeController = null;
    }
    super.destroy();
  }
}
