/**
 * RESIZE HANDLER
 * Обработка изменения размера окна с дебаунсингом.
 * 
 * При изменении размера окна:
 * 1. Инвалидирует кэш CSS переменных
 * 2. Запускает репагинацию (если книга открыта)
 */

import { cssVars } from '../utils/CSSVariables.js';

export class ResizeHandler {
  /**
   * @param {Object} context
   */
  constructor(context) {
    this.eventManager = context.eventManager;
    this.timerManager = context.timerManager;
    this.repaginateFn = context.repaginateFn;
    this.isOpenedFn = context.isOpenedFn;
    this.isDestroyedFn = context.isDestroyedFn;

    this.resizeTimer = null;
    this.debounceDelay = cssVars.getTime("--timing-resize-debounce", 150);

    // Сохраняем начальную ширину для сравнения
    this.lastWidth = window.innerWidth;
  }

  /**
   * Привязать обработчик resize
   */
  bind() {
    this.eventManager.add(window, "resize", () => this._handleResize());
    this.eventManager.add(document, "fullscreenchange", () => this._handleFullscreenChange());
    this.eventManager.add(document, "webkitfullscreenchange", () => this._handleFullscreenChange());
  }

  /**
   * Обработать resize с дебаунсингом
   * @private
   */
  _handleResize() {
    const currentWidth = window.innerWidth;

    // На мобильных устройствах при скролле адресная строка браузера
    // скрывается/появляется, что меняет высоту viewport и триггерит resize.
    // Репагинация нужна только при изменении ширины.
    if (currentWidth === this.lastWidth) {
      return;
    }

    this.lastWidth = currentWidth;

    if (this.resizeTimer) {
      this.timerManager.clearTimeout(this.resizeTimer);
    }

    this.resizeTimer = this.timerManager.setTimeout(() => {
      if (this.isOpenedFn() && !this.isDestroyedFn()) {
        cssVars.invalidateCache();
        this.repaginateFn(true);
      }
    }, this.debounceDelay);
  }

  /**
   * Обработать смену полноэкранного режима.
   * В отличие от resize, здесь всегда нужна репагинация,
   * т.к. высота viewport меняется существенно.
   * @private
   */
  _handleFullscreenChange() {
    this.lastWidth = window.innerWidth;

    if (this.resizeTimer) {
      this.timerManager.clearTimeout(this.resizeTimer);
    }

    this.resizeTimer = this.timerManager.setTimeout(() => {
      if (this.isOpenedFn() && !this.isDestroyedFn()) {
        cssVars.invalidateCache();
        this.repaginateFn(true);
      }
    }, this.debounceDelay);
  }

  /**
   * Очистить таймер
   */
  destroy() {
    if (this.resizeTimer) {
      this.timerManager.clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  }
}
