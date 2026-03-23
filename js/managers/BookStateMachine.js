/**
 * BOOK STATE MACHINE
 * Конечный автомат для управления состоянием книги.
 *
 * Граф переходов:
 * ```
 * CLOSED → OPENING → OPENED ⇄ FLIPPING
 *                         ↓
 *                      CLOSING → CLOSED
 * ```
 *
 * Гарантирует валидность переходов между состояниями.
 * Невалидные переходы игнорируются с предупреждением в консоль.
 *
 * @example
 * const fsm = new BookStateMachine();
 * fsm.subscribe((newState, oldState) => {
 *   console.log(`${oldState} → ${newState}`);
 * });
 *
 * fsm.transitionTo(BookState.OPENING); // true
 * fsm.transitionTo(BookState.FLIPPING); // false (невалидный переход)
 */

import { BookState } from '../config.js';

/**
 * @typedef {Function} StateListener
 * @param {string} newState - Новое состояние
 * @param {string} oldState - Предыдущее состояние
 */

export class BookStateMachine {
  /**
   * Создаёт конечный автомат состояний книги
   * @param {string} [initialState=BookState.CLOSED] - Начальное состояние
   */
  constructor(initialState = BookState.CLOSED) {
    /** @type {string} Текущее состояние */
    this._state = initialState;

    /** @type {Set<StateListener>} Подписчики на изменения состояния */
    this._listeners = new Set();

    /**
     * Граф допустимых переходов: состояние → множество разрешённых целевых состояний
     * @type {Map<string, Set<string>>}
     * @private
     */
    this._transitions = new Map([
      [BookState.CLOSED, new Set([BookState.OPENING])],
      [BookState.OPENING, new Set([BookState.OPENED])],
      [BookState.OPENED, new Set([BookState.FLIPPING, BookState.CLOSING])],
      [BookState.FLIPPING, new Set([BookState.OPENED])],
      [BookState.CLOSING, new Set([BookState.CLOSED])],
    ]);
  }

  /**
   * Текущее состояние
   * @returns {string}
   */
  get state() { return this._state; }

  /**
   * Книга закрыта
   * @returns {boolean}
   */
  get isClosed() { return this._state === BookState.CLOSED; }

  /**
   * Книга открыта и готова к взаимодействию
   * @returns {boolean}
   */
  get isOpened() { return this._state === BookState.OPENED; }

  /**
   * Страница перелистывается (анимация)
   * @returns {boolean}
   */
  get isFlipping() { return this._state === BookState.FLIPPING; }

  /**
   * Книга занята анимацией (opening/flipping/closing)
   *
   * Используется для блокировки пользовательского ввода во время анимаций.
   * @returns {boolean}
   */
  get isBusy() {
    return this._state === BookState.OPENING ||
           this._state === BookState.FLIPPING ||
           this._state === BookState.CLOSING;
  }

  /**
   * Проверить возможность перехода в указанное состояние
   *
   * @param {string} newState - Целевое состояние
   * @returns {boolean} true, если переход разрешён
   */
  canTransitionTo(newState) {
    const allowed = this._transitions.get(this._state);
    return allowed ? allowed.has(newState) : false;
  }

  /**
   * Выполнить переход в новое состояние
   *
   * При успешном переходе уведомляет всех подписчиков.
   * Ошибки в подписчиках логируются, но не прерывают уведомление остальных.
   *
   * @param {string} newState - Целевое состояние
   * @returns {boolean} true, если переход выполнен; false, если невалидный
   */
  transitionTo(newState) {
    if (!this.canTransitionTo(newState)) {
      console.warn(`Invalid state transition: ${this._state} → ${newState}`);
      return false;
    }

    const oldState = this._state;
    this._state = newState;

    for (const listener of this._listeners) {
      try {
        listener(newState, oldState);
      } catch (e) {
        console.error("State listener error:", e);
      }
    }
    return true;
  }

  /**
   * Подписаться на изменения состояния
   *
   * @param {StateListener} listener - Функция-обработчик (newState, oldState)
   * @returns {Function} Функция отписки
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Принудительно перейти в состояние (без валидации переходов)
   *
   * Используется для восстановления после ошибок, когда нормальный
   * переход невозможен (например, OPENED → OPENED).
   * Допускает только стабильные состояния (OPENED, CLOSED) как целевые,
   * чтобы предотвратить зависание в промежуточном состоянии.
   * Уведомляет подписчиков, если состояние изменилось.
   *
   * @param {string} newState - Целевое состояние (только OPENED или CLOSED)
   */
  forceTransitionTo(newState) {
    if (!BookStateMachine.RECOVERY_STATES.has(newState)) {
      console.warn(`forceTransitionTo: состояние "${newState}" не допускается для принудительного перехода. Допустимы: ${[...BookStateMachine.RECOVERY_STATES].join(', ')}`);
      return;
    }

    const oldState = this._state;
    if (oldState === newState) return;

    this._state = newState;

    for (const listener of this._listeners) {
      try {
        listener(newState, oldState);
      } catch (e) {
        console.error("State listener error:", e);
      }
    }
  }

  /**
   * Сбросить состояние машины (без валидации переходов)
   *
   * Используется для инициализации или восстановления состояния.
   * По умолчанию уведомляет подписчиков об изменении.
   *
   * @param {string} [state=BookState.CLOSED] - Состояние для установки
   * @param {Object} [options] - Опции
   * @param {boolean} [options.silent=false] - Не уведомлять подписчиков
   */
  reset(state = BookState.CLOSED, { silent = false } = {}) {
    const oldState = this._state;
    this._state = state;

    // Уведомляем подписчиков если состояние изменилось и не silent-режим
    if (!silent && oldState !== state) {
      for (const listener of this._listeners) {
        try {
          listener(state, oldState);
        } catch (e) {
          console.error("State listener error:", e);
        }
      }
    }
  }

  /**
   * Очистить все подписки
   */
  destroy() {
    this._listeners.clear();
  }
}

/**
 * Допустимые состояния для принудительного перехода (восстановление после ошибок).
 * Только стабильные состояния — промежуточные (OPENING, CLOSING, FLIPPING) запрещены.
 * @type {Set<string>}
 */
BookStateMachine.RECOVERY_STATES = Object.freeze(new Set([
  BookState.OPENED,
  BookState.CLOSED,
]));
