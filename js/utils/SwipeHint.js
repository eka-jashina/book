/**
 * SWIPE HINT
 *
 * Подсказка о жесте свайпа для мобильных пользователей.
 * Показывается один раз при первом открытии книги на мобильном устройстве.
 */

import { StorageManager } from './StorageManager.js';

const AUTO_HIDE_DELAY = 3500;

const storage = new StorageManager('flipbook-swipe-hint-shown');

export class SwipeHint {
  constructor() {
    this._el = document.getElementById('swipe-hint');
    this._timer = null;
  }

  /**
   * Показать подсказку, если ещё не показывалась и экран мобильный.
   * Вызывается после открытия книги.
   */
  showIfNeeded() {
    if (!this._el) return;

    // Не показывать на десктопе
    if (window.matchMedia('(min-width: 769px)').matches) return;

    // Не показывать повторно
    if (storage.getRaw()) return;

    this._show();
  }

  _show() {
    this._el.hidden = false;

    requestAnimationFrame(() => {
      this._el.classList.add('swipe-hint--visible');
    });

    // Скрыть по таймеру
    this._timer = setTimeout(() => this._hide(), AUTO_HIDE_DELAY);

    // Скрыть по касанию
    this._el.addEventListener('click', () => this._hide(), { once: true });
    this._el.addEventListener('touchstart', () => this._hide(), { once: true, passive: true });
  }

  _hide() {
    clearTimeout(this._timer);

    this._el.classList.remove('swipe-hint--visible');

    // Запомнить что уже показали
    storage.setRaw('1');

    // Убрать из DOM после анимации
    setTimeout(() => {
      if (this._el) this._el.hidden = true;
    }, 400);
  }
}
