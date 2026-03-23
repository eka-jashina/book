/**
 * TIMER MANAGER
 * Обёртка над setTimeout и requestAnimationFrame.
 *
 * Особенности:
 * - Отслеживание всех активных таймеров
 * - Централизованная очистка при destroy
 * - Автоматическое удаление из Set после срабатывания
 * - Предотвращение утечек памяти при быстрых переходах
 */

export class TimerManager {
  constructor() {
    /** @type {Set<number>} Активные setTimeout ID */
    this.timeouts = new Set();
    /** @type {Set<number>} Активные requestAnimationFrame ID */
    this.animationFrames = new Set();
  }

  /**
   * Установить таймаут с отслеживанием
   * @param {Function} callback - Функция для вызова
   * @param {number} delay - Задержка в миллисекундах
   * @returns {number} ID таймера
   */
  setTimeout(callback, delay) {
    const id = setTimeout(() => {
      this.timeouts.delete(id);
      callback();
    }, delay);
    this.timeouts.add(id);
    return id;
  }

  /**
   * Отменить таймаут
   * @param {number} id - ID таймера
   */
  clearTimeout(id) {
    clearTimeout(id);
    this.timeouts.delete(id);
  }

  /**
   * Запросить animation frame с отслеживанием
   * @param {FrameRequestCallback} callback - Функция для вызова
   * @returns {number} ID запроса
   */
  requestAnimationFrame(callback) {
    const id = requestAnimationFrame((timestamp) => {
      this.animationFrames.delete(id);
      callback(timestamp);
    });
    this.animationFrames.add(id);
    return id;
  }

  /**
   * Отменить animation frame
   * @param {number} id - ID запроса
   */
  cancelAnimationFrame(id) {
    cancelAnimationFrame(id);
    this.animationFrames.delete(id);
  }

  /**
   * Очистить все активные таймеры и animation frames
   */
  clear() {
    for (const id of this.timeouts) clearTimeout(id);
    this.timeouts.clear();
    for (const id of this.animationFrames) cancelAnimationFrame(id);
    this.animationFrames.clear();
  }
}
