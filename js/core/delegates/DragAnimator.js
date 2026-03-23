/**
 * DRAG ANIMATOR
 * Анимация угла поворота страницы при drag-перелистывании.
 *
 * Отвечает за:
 * - Плавную анимацию от текущего угла до целевого (0° или 180°)
 * - Easing-функцию для естественного движения
 * - Расчёт длительности анимации
 */

import { cssVars } from "../../utils/CSSVariables.js";

export class DragAnimator {
  constructor() {
    /** @type {number|null} ID текущего requestAnimationFrame */
    this._animationId = null;
  }

  /**
   * Анимировать угол от текущего значения до целевого
   * @param {number} startAngle - Начальный угол
   * @param {number} targetAngle - Целевой угол (0 или 180)
   * @param {Function} onFrame - Коллбэк для каждого кадра (angle) => void
   * @param {Function} onComplete - Коллбэк по завершении () => void
   */
  animate(startAngle, targetAngle, onFrame, onComplete) {
    // Отменяем предыдущую анимацию, если есть
    this.cancel();

    const duration = this._calculateDuration(startAngle, targetAngle);
    const startTime = performance.now();

    const tick = (now) => {
      try {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / duration, 1);
        const eased = this._easeInOutQuad(t);

        const currentAngle = startAngle + (targetAngle - startAngle) * eased;
        onFrame(currentAngle);

        if (t < 1) {
          this._animationId = requestAnimationFrame(tick);
        } else {
          this._animationId = null;
          onComplete();
        }
      } catch (error) {
        this._animationId = null;
        console.error("DragAnimator: animation frame error, forcing completion", error);
        onComplete();
      }
    };

    this._animationId = requestAnimationFrame(tick);
  }

  /**
   * Отменить текущую анимацию
   */
  cancel() {
    if (this._animationId !== null) {
      cancelAnimationFrame(this._animationId);
      this._animationId = null;
    }
  }

  /**
   * Рассчитать длительность анимации.
   * Длительность пропорциональна оставшемуся углу.
   * @private
   * @param {number} startAngle - Начальный угол
   * @param {number} targetAngle - Целевой угол
   * @returns {number} Длительность в миллисекундах
   */
  _calculateDuration(startAngle, targetAngle) {
    const baseDuration = cssVars.getTime("--timing-rotate", 350);
    const angleDelta = Math.abs(targetAngle - startAngle);

    // Минимум 150ms, максимум — полное время поворота
    return Math.max(150, (baseDuration * angleDelta) / 180);
  }

  /**
   * Easing-функция: ease-in-out quad
   * Плавное ускорение в начале и замедление в конце.
   * @private
   * @param {number} t - Прогресс (0-1)
   * @returns {number} Eased прогресс (0-1)
   */
  _easeInOutQuad(t) {
    return t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /**
   * Очистка ресурсов
   */
  destroy() {
    this.cancel();
  }
}
