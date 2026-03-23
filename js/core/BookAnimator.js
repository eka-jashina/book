/**
 * BOOK ANIMATOR
 * Управляет анимациями книги.
 *
 * Особенности:
 * - Трёхфазная анимация перелистывания: lift → rotate → drop
 * - Web Animations API для перелистывания (обходит баг Chromium
 *   compositor, при котором CSS transitions теряют 3D-перспективу
 *   после смены темы)
 * - CSS transitions для открытия/закрытия книги
 * - Поддержка отмены операций через AbortController
 * - Тайминги читаются из CSS-переменных
 */

import { cssVars } from '../utils/CSSVariables.js';
import { TransitionHelper } from '../utils/TransitionHelper.js';
import { getConfig, BookState, Direction } from '../config.js';

export class BookAnimator {
  /**
   * @param {Object} options - Конфигурация аниматора
   * @param {HTMLElement} options.book - Контейнер книги
   * @param {HTMLElement} options.bookWrap - Внешняя обёртка книги
   * @param {HTMLElement} options.cover - Обложка книги
   * @param {HTMLElement} options.sheet - Перелистываемый лист
   * @param {TimerManager} options.timerManager - Менеджер таймеров
   */
  constructor(options) {
    this.elements = {
      book: options.book,
      bookWrap: options.bookWrap,
      cover: options.cover,
      sheet: options.sheet,
    };

    this.timerManager = options.timerManager;
    /** @type {AbortController|null} Контроллер текущей операции */
    this.operationController = null;
  }

  /**
   * Получить все тайминги анимаций из CSS-переменных
   * @returns {Object} Объект с таймингами в мс
   */
  getTimings() {
    return {
      lift: cssVars.getTime("--timing-lift", 240),
      rotate: cssVars.getTime("--timing-rotate", 900),
      drop: cssVars.getTime("--timing-drop", 160),
      cover: cssVars.getTime("--timing-cover", 1200),
      wrap: cssVars.getTime("--timing-wrap", 300),
      swapNext: cssVars.getTime("--timing-swap-next", 30),
      swapPrev: cssVars.getTime("--timing-swap-prev", 100),
    };
  }

  /**
   * Создать новый AbortSignal для операции (отменяет предыдущую)
   * @returns {AbortSignal}
   */
  createSignal() {
    this.abort();
    this.operationController = new AbortController();
    return this.operationController.signal;
  }

  /**
   * Отменить текущую операцию
   */
  abort() {
    if (this.operationController) {
      this.operationController.abort();
      this.operationController = null;
    }
  }

  /**
   * Запустить анимацию перелистывания страницы.
   *
   * Используем Web Animations API вместо CSS transitions.
   * Причина: в Chromium после смены темы (массовый style recalc)
   * compositor теряет 3D-контекст для CSS transitions, но не для
   * прямых transform-манипуляций. Web Animations API работает
   * как прямые манипуляции — обходит баг.
   *
   * Фазы: lift (поднятие) → rotate (поворот) → drop (опускание)
   * @param {'next'|'prev'} direction - Направление перелистывания
   * @param {Function} onSwap - Коллбэк для подмены буферов (вызывается во время rotate)
   */
  async runFlip(direction, onSwap) {
    const signal = this.createSignal();
    const timings = this.getTimings();
    const { book, sheet } = this.elements;

    const targetRotation = direction === Direction.NEXT ? -180 : 180;

    book.dataset.state = BookState.FLIPPING;
    sheet.dataset.direction = direction;

    try {
      // Фаза 1: Lift (поднятие страницы)
      await this._animate(sheet, signal,
        { transform: 'translateZ(0px) rotateY(0deg)' },
        { transform: 'translateZ(1px) rotateY(0deg)' },
        timings.lift, 'ease-out'
      );

      // Фаза 2: Rotate (поворот страницы на 180°)
      // Подмена буферов происходит в начале поворота.
      const swapDelay = direction === Direction.NEXT ? timings.swapNext : timings.swapPrev;
      this.timerManager.setTimeout(() => {
        if (!signal.aborted) {
          book.dataset.noTransition = 'true';
          onSwap();
          requestAnimationFrame(() => {
            delete book.dataset.noTransition;
          });
        }
      }, swapDelay);

      await this._animate(sheet, signal,
        { transform: 'translateZ(1px) rotateY(0deg)' },
        { transform: `translateZ(1px) rotateY(${targetRotation}deg)` },
        timings.rotate, 'cubic-bezier(0.25, 0.6, 0.25, 1)'
      );

      // Фаза 3: Drop (опускание страницы)
      await this._animate(sheet, signal,
        { transform: `translateZ(1px) rotateY(${targetRotation}deg)` },
        { transform: `translateZ(0px) rotateY(${targetRotation}deg)` },
        timings.drop, 'ease-in'
      );

    } finally {
      // Отменяем оставшиеся Web Animations и очищаем состояние
      sheet.getAnimations().forEach(a => a.cancel());
      delete sheet.dataset.phase;
      delete sheet.dataset.direction;
    }
  }

  /**
   * Запустить Web Animation на элементе с поддержкой отмены.
   *
   * @param {HTMLElement} element - Анимируемый элемент
   * @param {AbortSignal} signal - Сигнал отмены
   * @param {Object} from - Начальный keyframe
   * @param {Object} to - Конечный keyframe
   * @param {number} duration - Длительность в мс
   * @param {string} easing - CSS easing функция
   * @returns {Promise<void>}
   * @private
   */
  _animate(element, signal, from, to, duration, easing) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }

      const animation = element.animate([from, to], {
        duration,
        easing,
        fill: 'forwards',
      });

      const onAbort = () => {
        animation.cancel();
        reject(new DOMException("Aborted", "AbortError"));
      };

      signal.addEventListener('abort', onAbort, { once: true });

      animation.finished.then(() => {
        signal.removeEventListener('abort', onAbort);
        resolve();
      }).catch(err => {
        signal.removeEventListener('abort', onAbort);
        // animation.cancel() выбрасывает AbortError — пробрасываем
        if (err.name === 'AbortError') {
          reject(new DOMException("Aborted", "AbortError"));
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Запустить анимацию открытия книги (первая часть)
   * @returns {Promise<AbortSignal|null>} Signal для продолжения или null при отмене
   */
  async runOpenAnimation() {
    const signal = this.createSignal();
    const timings = this.getTimings();
    const { bookWrap, book, cover } = this.elements;
    const safetyMargin = getConfig().TIMING_SAFETY_MARGIN;

    // Устанавливаем начальные состояния
    bookWrap.dataset.state = BookState.OPENED;
    book.dataset.state = BookState.OPENING;
    cover.dataset.animation = "opening";

    try {
      // Ждём расширения обёртки
      await TransitionHelper.waitFor(
        bookWrap, "width", timings.wrap + safetyMargin, signal
      );

      // Два RAF для стабилизации layout
      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(resolve);
        });
      });

      return signal;
    } catch (error) {
      if (error.name !== "AbortError") throw error;
      return null;
    }
  }

  /**
   * Завершить анимацию открытия книги (вторая часть)
   * @param {AbortSignal} signal - Signal от runOpenAnimation
   */
  async finishOpenAnimation(signal) {
    const timings = this.getTimings();
    const { cover } = this.elements;
    const safetyMargin = getConfig().TIMING_SAFETY_MARGIN;

    // Ждём завершения анимации обложки
    await TransitionHelper.waitFor(
      cover, "transform", timings.cover + safetyMargin, signal
    );

    delete cover.dataset.animation;
  }

  /**
   * Запустить анимацию закрытия книги
   */
  async runCloseAnimation() {
    const signal = this.createSignal();
    const timings = this.getTimings();
    const { bookWrap, book, cover } = this.elements;
    const safetyMargin = getConfig().TIMING_SAFETY_MARGIN;

    // Устанавливаем состояния закрытия
    bookWrap.dataset.state = BookState.CLOSED;
    book.dataset.state = BookState.CLOSING;
    cover.dataset.animation = "closing";

    try {
      // Параллельно анимируем обёртку и обложку
      await Promise.all([
        TransitionHelper.waitFor(bookWrap, "width", timings.wrap + safetyMargin, signal),
        TransitionHelper.waitFor(cover, "transform", timings.cover + safetyMargin, signal),
      ]);

      delete cover.dataset.animation;
    } catch (error) {
      if (error.name !== "AbortError") throw error;
    }
  }

  /**
   * Очистить ресурсы
   */
  destroy() {
    this.abort();
    this.elements = null;
  }
}
