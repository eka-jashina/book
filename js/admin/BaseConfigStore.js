/**
 * BaseConfigStore
 *
 * Общий базовый класс для AdminConfigStore и ServerAdminConfigStore.
 * Предоставляет единый интерфейс уведомлений (onError, onSave),
 * ожидание завершения сохранения (waitForSave) и обработку ошибок.
 *
 * Конкретные реализации переопределяют _save() для своей логики персистенции.
 */

export class BaseConfigStore {
  constructor() {
    /** @type {Promise|null} Промис текущего сохранения */
    this._savePromise = null;
    /** @type {((error: Error|string) => void)|null} Колбэк ошибки */
    this._onError = null;
    /** @type {(() => void)|null} Колбэк успешного сохранения */
    this._onSave = null;
  }

  /**
   * Колбэк ошибки
   * @param {((error: Error|string) => void)|null} callback
   */
  get onError() { return this._onError; }
  set onError(callback) { this._onError = callback; }

  /**
   * Колбэк успешного сохранения
   * @param {(() => void)|null} callback
   */
  get onSave() { return this._onSave; }
  set onSave(callback) { this._onSave = callback; }

  /**
   * Уведомить UI об ошибке
   * @param {string} action - Описание операции
   * @param {Error} err - Ошибка
   */
  _handleError(action, err) {
    const message = `${action}: ${err.message || 'Ошибка'}`;
    console.error(message, err);
    if (this._onError) this._onError(message);
  }

  /**
   * Уведомить UI об успешном сохранении
   * @protected
   */
  _notifySave() {
    if (this._onSave) this._onSave();
  }

  /**
   * Дождаться завершения последнего сохранения
   * @returns {Promise<void>}
   */
  async waitForSave() {
    if (this._savePromise) {
      await this._savePromise;
    }
  }
}
