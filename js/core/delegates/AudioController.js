/**
 * AUDIO CONTROLLER
 * Управление звуками: переключение, громкость, ambient-звуки.
 * Выделен из SettingsDelegate для снижения cyclomatic complexity.
 */

import { sanitizeVolume } from "../../utils/index.js";

export class AudioController {
  /**
   * @param {Object} deps
   * @param {Object} deps.settings - SettingsManager
   * @param {Object} [deps.soundManager] - SoundManager
   * @param {Object} [deps.ambientManager] - AmbientManager
   */
  constructor(deps) {
    this._settings = deps.settings;
    this._soundManager = deps.soundManager;
    this._ambientManager = deps.ambientManager;
  }

  /**
   * Применить текущие аудио-настройки
   */
  apply() {
    if (this._soundManager) {
      this._soundManager.setEnabled(!!this._settings.get("soundEnabled"));
      this._soundManager.setVolume(sanitizeVolume(this._settings.get("soundVolume"), 0.3));
    }

    // НЕ запускаем воспроизведение ambient — на мобильных браузерах
    // audio требует user gesture. Воспроизведение запустится
    // после первого взаимодействия (открытия книги).
    if (this._ambientManager) {
      this._ambientManager.setVolume(sanitizeVolume(this._settings.get("ambientVolume"), 0.5));
    }
  }

  /**
   * Обработать переключение звука
   * @param {boolean} enabled
   */
  handleSoundToggle(enabled) {
    if (this._soundManager) {
      this._soundManager.setEnabled(enabled);
    }
  }

  /**
   * Обработать изменение громкости звука
   * @param {'increase'|'decrease'|number} action
   */
  handleSoundVolume(action) {
    if (!this._soundManager) return;

    if (typeof action === "number") {
      const volume = Math.max(0, Math.min(action, 1));
      this._soundManager.setVolume(volume);
      return;
    }

    const current = this._settings.get("soundVolume");
    const step = 0.1;
    let newVolume = current;

    if (action === "increase") {
      newVolume = Math.min(current + step, 1);
    } else if (action === "decrease") {
      newVolume = Math.max(current - step, 0);
    }

    if (newVolume !== current) {
      this._settings.set("soundVolume", newVolume);
      this._soundManager.setVolume(newVolume);
    }
  }

  /**
   * Обработать изменение типа ambient звука
   * @param {string} type
   */
  handleAmbientType(type) {
    if (this._ambientManager) {
      this._ambientManager.setType(type, true);
    }
  }

  /**
   * Обработать изменение громкости ambient
   * @param {number} volume
   */
  handleAmbientVolume(volume) {
    if (this._ambientManager) {
      this._ambientManager.setVolume(sanitizeVolume(volume, 0.5));
    }
  }
}
