/**
 * DRAG DELEGATE
 * Управление drag-перелистыванием страниц.
 *
 * Использует вспомогательные классы:
 * - DragDOMPreparer — подготовка и очистка DOM
 * - DragShadowRenderer — рендеринг теней
 * - DragAnimator — анимация угла поворота
 *
 * Жизненный цикл drag-операции:
 * 1. _startDrag()            → Инициализация: проверка возможности, захват координат
 * 2. domPreparer.prepare()   → Подготовка DOM: буфер, sheet, отключение transitions
 * 3. _updateAngle()          → Цикл: обновление угла по позиции курсора/пальца
 * 4. _render()               → Цикл: применение угла к CSS-переменным
 * 5. _endDrag()              → Решение: завершить (>90°) или отменить (<90°)
 * 6. animator.animate        → Анимация до целевого угла (0° или 180°)
 * 7. domPreparer.cleanup*()  → Очистка CSS-переменных и состояния
 * 8. _completeFlip()         → При успехе: swap буферов, обновление индекса
 *    _cancelFlip()           → При отмене: возврат видимости страниц
 */

import { BookState, Direction } from "../../config.js";
import { BaseDelegate, DelegateEvents } from './BaseDelegate.js';
import { DragDOMPreparer } from './DragDOMPreparer.js';
import { DragShadowRenderer } from './DragShadowRenderer.js';
import { DragAnimator } from './DragAnimator.js';

export class DragDelegate extends BaseDelegate {
  /**
   * @param {Object} deps
   * @param {BookStateMachine} deps.stateMachine
   * @param {BookRenderer} deps.renderer
   * @param {BookAnimator} deps.animator
   * @param {SoundManager} deps.soundManager
   * @param {DOMManager} deps.dom
   * @param {EventListenerManager} deps.eventManager
   * @param {MediaQueryManager} deps.mediaQueries
   * @param {Object} deps.state
   */
  constructor(deps) {
    super(deps);
    this.eventManager = deps.eventManager;

    // Вспомогательные классы
    this.domPreparer = new DragDOMPreparer(this.dom, this.renderer);
    this.shadowRenderer = new DragShadowRenderer(this.dom);
    this.dragAnimator = new DragAnimator();

    // Состояние drag
    this.isDragging = false;
    this.direction = null;
    this.currentAngle = 0;
    this.startX = 0;

    // Кэшированные значения
    this.bookWidth = 0;
    this.bookRect = null;
    this._cachedBookRect = null;

    // RAF throttling для move-событий
    this._rafId = null;
    this._pendingEvent = null;

    // Привязанные обработчики для корректного удаления
    this._boundHandlers = {
      onMouseMove: this._onMouseMove.bind(this),
      onMouseUp: this._onMouseUp.bind(this),
      onTouchMove: this._onTouchMove.bind(this),
      onTouchEnd: this._onTouchEnd.bind(this),
    };
  }

  /**
   * Валидация зависимостей
   * @protected
   */
  _validateRequiredDependencies(deps) {
    this._validateDependencies(
      deps,
      ['stateMachine', 'renderer', 'dom', 'eventManager', 'mediaQueries', 'state'],
      'DragDelegate'
    );
  }

  /**
   * Активен ли drag в данный момент
   * @returns {boolean}
   */
  get isActive() {
    return this.isDragging;
  }

  // ═══════════════════════════════════════════
  // ПУБЛИЧНЫЙ API
  // ═══════════════════════════════════════════

  /**
   * Привязать события к зонам захвата
   */
  bind() {
    const book = this.dom.get("book");
    if (!book) return;

    // Кэшируем bookRect при привязке — избегаем forced reflow в mousedown.
    // getBoundingClientRect на книге с 300+ клонами страниц вызывает
    // пересчёт layout всего DOM (~200мс). Кэш обновляется при resize.
    this._updateCachedBookRect();
    this.eventManager.add(window, "resize", () => {
      this._cachedBookRect = null;
    });

    const corners = book.querySelectorAll(".corner-zone");

    corners.forEach((zone) => {
      this.eventManager.add(zone, "mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._startDrag(e, zone.dataset.dir);
      });

      this.eventManager.add(
        zone,
        "touchstart",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._startDrag(e.touches[0], zone.dataset.dir);
        },
        { passive: false },
      );
    });

    // Глобальные обработчики движения и отпускания
    this.eventManager.add(document, "mousemove", this._boundHandlers.onMouseMove);
    this.eventManager.add(document, "mouseup", this._boundHandlers.onMouseUp);
    this.eventManager.add(document, "touchmove", this._boundHandlers.onTouchMove, { passive: false });
    this.eventManager.add(document, "touchend", this._boundHandlers.onTouchEnd);
  }

  /**
   * Обновить кэш bookRect (без forced reflow в mousedown)
   */
  _updateCachedBookRect() {
    const book = this.dom?.get("book");
    if (book) {
      this._cachedBookRect = book.getBoundingClientRect();
    }
  }

  // ═══════════════════════════════════════════
  // ПРОВЕРКИ ВОЗМОЖНОСТИ ДЕЙСТВИЯ
  // ═══════════════════════════════════════════

  /**
   * Проверить возможность перелистывания вперёд
   * @returns {boolean} true если есть следующие страницы
   */
  canFlipNext() {
    if (!this.isOpened) return false;
    const maxIndex = this.renderer.getMaxIndex(this.isMobile);
    return this.currentIndex + this.pagesPerFlip <= maxIndex;
  }

  /**
   * Проверить возможность перелистывания назад
   * @returns {boolean} true если есть предыдущие страницы
   */
  canFlipPrev() {
    if (!this.isOpened) return false;
    return this.currentIndex > 0;
  }

  // ═══════════════════════════════════════════
  // ЖИЗНЕННЫЙ ЦИКЛ DRAG
  // ═══════════════════════════════════════════

  /**
   * Начать drag-операцию
   * @private
   * @param {MouseEvent|Touch} e - Событие мыши или touch
   * @param {string} dir - Направление: 'next' или 'prev'
   */
  _startDrag(e, dir) {
    if (this.isBusy) return;

    if (dir === Direction.NEXT && !this.canFlipNext()) return;
    if (dir === Direction.PREV && !this.canFlipPrev()) return;

    // Переходим в FLIPPING через state machine, чтобы заблокировать
    // конкурентные операции (навигация, другой drag)
    if (!this.stateMachine.transitionTo(BookState.FLIPPING)) return;

    this.isDragging = true;
    this.direction = dir;
    this.startX = e.clientX;
    this.currentAngle = 0;

    const book = this.dom.get("book");
    if (!book) return;

    // Используем кэшированный rect чтобы не вызывать forced reflow.
    // getBoundingClientRect на книге с клонами 300+ страниц = ~200мс reflow.
    // Кэш сбрасывается при resize и обновляется лениво.
    if (!this._cachedBookRect) {
      this._updateCachedBookRect();
    }
    this.bookRect = this._cachedBookRect;
    this.bookWidth = this.bookRect.width;

    this.domPreparer.prepare(dir, this.currentIndex, this.pagesPerFlip, this.isMobile);
    this.shadowRenderer.activate(this.direction);
    this._updateAngleFromEvent(e);
  }

  // ═══════════════════════════════════════════
  // ДВИЖЕНИЕ
  // ═══════════════════════════════════════════

  /**
   * Запланировать обновление угла через RAF (throttling).
   * Ограничивает частоту обновлений до частоты обновления экрана.
   * @private
   * @param {MouseEvent|Touch} e - Событие с координатами
   */
  _scheduleUpdate(e) {
    this._pendingEvent = e;

    if (this._rafId !== null) return;

    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (this._pendingEvent && this.isDragging) {
        this._updateAngleFromEvent(this._pendingEvent);
        this._pendingEvent = null;
      }
    });
  }

  /** @private Обработчик движения мыши */
  _onMouseMove(e) {
    if (!this.isDragging) return;
    this._scheduleUpdate(e);
  }

  /** @private Обработчик движения touch */
  _onTouchMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    this._scheduleUpdate(e.touches[0]);
  }

  /**
   * Пересчитать угол поворота страницы по позиции курсора.
   * Угол 0° = страница на месте, 180° = полностью перевёрнута.
   * @private
   * @param {MouseEvent|Touch} e - Событие с координатами
   */
  _updateAngleFromEvent(e) {
    if (!this.bookRect || this.bookWidth <= 0) return;

    const x = e.clientX - this.bookRect.left;

    if (this.direction === Direction.NEXT) {
      const progress = 1 - x / this.bookWidth;
      this.currentAngle = Math.max(0, Math.min(180, progress * 180));
    } else {
      const progress = x / this.bookWidth;
      this.currentAngle = Math.max(0, Math.min(180, progress * 180));
    }

    this._render();
  }

  /**
   * Применить текущий угол к sheet transform и теням.
   * Используем style.transform напрямую (не CSS-переменную),
   * чтобы избежать cascade через подэлементы sheet.
   * @private
   */
  _render() {
    const angle = this.direction === Direction.NEXT ? -this.currentAngle : this.currentAngle;

    const sheet = this.dom.get("sheet");
    if (sheet) {
      sheet.style.transform = `translateZ(1px) rotateY(${angle}deg)`;
    }

    this.shadowRenderer.update(this.currentAngle, this.direction, this.isMobile);
  }

  // ═══════════════════════════════════════════
  // ЗАВЕРШЕНИЕ
  // ═══════════════════════════════════════════

  /** @private Обработчик отпускания мыши */
  _onMouseUp() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  /** @private Обработчик окончания touch */
  _onTouchEnd() {
    if (!this.isDragging) return;
    this._endDrag();
  }

  /**
   * Завершить drag-операцию.
   * Если угол > 90° — завершить перелистывание, иначе — отменить.
   * @private
   */
  _endDrag() {
    if (!this.isDragging) return;
    this.isDragging = false;

    const willComplete = this.currentAngle > 90;
    const targetAngle = willComplete ? 180 : 0;

    try {
      this.dragAnimator.animate(
        this.currentAngle,
        targetAngle,
        (angle) => {
          this.currentAngle = angle;
          this._render();
        },
        () => this._finish(willComplete)
      );
    } catch (error) {
      console.error("DragDelegate: animation failed, recovering state", error);
      this._finish(willComplete);
    }
  }

  /**
   * Финализация после завершения анимации.
   * Очищает sheet/dragging-атрибуты и вызывает _completeFlip или _cancelFlip.
   * @private
   * @param {boolean} completed - true если перелистывание успешно
   */
  _finish(completed) {
    const direction = this.direction;

    this.domPreparer.cleanupSheet();
    this.shadowRenderer.reset();

    // Возвращаемся в OPENED через state machine
    this.stateMachine.transitionTo(BookState.OPENED);

    if (completed) {
      this._completeFlip(direction);
    } else {
      this._cancelFlip();
    }

    this.direction = null;
    this.currentAngle = 0;
  }

  /**
   * Завершить перелистывание: обменять буферы, обновить индекс, воспроизвести звук
   * @private
   * @param {string} direction - Направление перелистывания
   */
  _completeFlip(direction) {
    const newIndex =
      direction === Direction.NEXT
        ? this.currentIndex + this.pagesPerFlip
        : this.currentIndex - this.pagesPerFlip;

    this._playFlipSound();
    this.renderer.swapBuffers();

    // Уведомляем контроллер об изменении индекса и главы
    this.emit(DelegateEvents.INDEX_CHANGE, newIndex);
    this.emit(DelegateEvents.CHAPTER_UPDATE);

    this.domPreparer.cleanupPages(true);
  }

  /**
   * Отменить перелистывание: вернуть страницы в исходное состояние
   * @private
   */
  _cancelFlip() {
    this.domPreparer.cleanupPages(false);
  }

  /**
   * Очистка
   */
  destroy() {
    // Отменяем RAF throttling
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._pendingEvent = null;

    // Отменяем текущую анимацию
    this.dragAnimator.cancel();

    // Очищаем вспомогательные классы
    this.domPreparer.destroy();
    this.shadowRenderer.destroy();
    this.dragAnimator.destroy();

    this.isDragging = false;
    this.direction = null;
    this.currentAngle = 0;
    this.bookWidth = 0;
    this.bookRect = null;
    this._boundHandlers = null;
    this.eventManager = null;
    this.domPreparer = null;
    this.shadowRenderer = null;
    this.dragAnimator = null;
    super.destroy();
  }
}
