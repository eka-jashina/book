/**
 * OFFLINE INDICATOR
 *
 * Показывает индикатор когда приложение работает без сети.
 * Автоматически появляется/исчезает при изменении состояния сети.
 */

export class OfflineIndicator {
  /**
   * @param {Object} [options]
   * @param {string} [options.message='Режим офлайн']
   * @param {string} [options.className='offline-indicator']
   */
  constructor(options = {}) {
    this._message = options.message || 'Режим офлайн';
    this._className = options.className || 'offline-indicator';
    /** @type {HTMLElement|null} */
    this._indicator = null;
    this._boundShow = this._show.bind(this);
    this._boundHide = this._hide.bind(this);

    this._bindEvents();
  }

  /**
   * Привязка событий сети
   * @private
   */
  _bindEvents() {
    window.addEventListener('online', this._boundHide);
    window.addEventListener('offline', this._boundShow);

    // Проверка состояния при старте
    if (!navigator.onLine) {
      this._show();
    }
  }

  /**
   * Показать индикатор
   * @private
   */
  _show() {
    if (this._indicator) return;

    this._indicator = document.getElementById('offline-indicator');
    if (!this._indicator) return;

    this._indicator.hidden = false;
  }

  /**
   * Скрыть индикатор
   * @private
   */
  _hide() {
    if (!this._indicator) return;

    this._indicator.hidden = true;
    this._indicator = null;
  }

  /**
   * Принудительно показать индикатор
   */
  show() {
    this._show();
  }

  /**
   * Принудительно скрыть индикатор
   */
  hide() {
    this._hide();
  }

  /**
   * Текущее состояние сети
   * @returns {boolean}
   */
  get isOnline() {
    return navigator.onLine;
  }

  /**
   * Индикатор отображается
   * @returns {boolean}
   */
  get isVisible() {
    return this._indicator !== null;
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    window.removeEventListener('online', this._boundHide);
    window.removeEventListener('offline', this._boundShow);
    this._hide();
  }
}

// Экспорт синглтона для удобства
export const offlineIndicator = new OfflineIndicator();
