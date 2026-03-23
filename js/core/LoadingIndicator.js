/**
 * LOADING INDICATOR
 * Управление оверлеем загрузки с кольцевым прогресс-баром.
 *
 * Особенности:
 * - Кольцевой SVG-прогресс с процентами
 * - Именованные фазы с локализованными сообщениями
 * - Простой show/hide интерфейс
 */

/** Длина окружности SVG-кольца (2 * PI * 28) */
const CIRCUMFERENCE = 2 * Math.PI * 28;

export class LoadingIndicator {
  /**
   * @param {HTMLElement} overlay - Элемент оверлея загрузки
   * @param {HTMLElement} progressEl - Элемент для отображения текста прогресса
   */
  constructor(overlay, progressEl) {
    this.overlay = overlay;
    this.progressEl = progressEl;
    this.ringFill = overlay?.querySelector('#loadingRingFill');
    this.ringPercent = overlay?.querySelector('#loadingRingPercent');
  }

  /**
   * Показать индикатор загрузки
   */
  show() {
    this.overlay.hidden = false;
    this._setRingProgress(0);
  }

  /**
   * Скрыть индикатор загрузки
   */
  hide() {
    this.overlay.hidden = true;
  }

  /**
   * Установить произвольный текст прогресса
   * @param {string} text - Текст для отображения
   */
  setProgress(text) {
    this.progressEl.textContent = text;
  }

  /**
   * Установить фазу загрузки с автоматическим текстом
   * @param {string} phase - Имя фазы (sanitize, parse, layout, content, align, chapters, slice, complete)
   * @param {number} progress - Процент выполнения (0-100)
   */
  setPhase(phase, progress) {
    const phases = {
      sanitize: "Подготовка...",
      parse: "Парсинг...",
      layout: "Разметка...",
      content: `Обработка контента: ${progress}%`,
      align: "Выравнивание...",
      chapters: "Анализ глав...",
      slice: `Нарезка страниц: ${Math.round((progress - 75) * 4)}%`,
      complete: "Готово!",
    };

    this.setProgress(phases[phase] || `${progress}%`);
    this._setRingProgress(progress);
  }

  /**
   * Обновить визуальное заполнение кольца
   * @param {number} percent - Процент (0-100)
   * @private
   */
  _setRingProgress(percent) {
    if (!this.ringFill) return;
    const clamped = Math.max(0, Math.min(100, percent));
    const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
    this.ringFill.setAttribute('stroke-dashoffset', String(offset));

    if (this.ringPercent) {
      this.ringPercent.textContent = clamped > 0 ? `${Math.round(clamped)}%` : '';
    }
  }
}
