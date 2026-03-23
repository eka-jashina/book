/**
 * EVENT EMITTER
 * Простая реализация паттерна Observer/PubSub.
 *
 * Позволяет компонентам подписываться на именованные события
 * и реагировать на них без прямой связи между издателем и подписчиком.
 *
 * @example
 * class MyComponent extends EventEmitter {
 *   doSomething() {
 *     this.emit('done', { result: 42 });
 *   }
 * }
 *
 * const component = new MyComponent();
 * const unsubscribe = component.on('done', (data) => console.log(data.result));
 * // Позже: unsubscribe();
 */
export class EventEmitter {
  /**
   * Создаёт новый EventEmitter
   * @param {Object} [options] - Опции
   * @param {Function} [options.onError] - Коллбэк при ошибке в обработчике (error, eventName)
   */
  constructor({ onError } = {}) {
    /**
     * Хранилище обработчиков событий
     * @type {Map<string, Set<Function>>}
     * @private
     */
    this._events = new Map();

    /** @private */
    this._onError = onError || null;
  }

  /**
   * Подписаться на событие
   *
   * @param {string} event - Имя события
   * @param {Function} handler - Функция-обработчик
   * @returns {Function} Функция отписки (вызов удаляет подписку)
   *
   * @example
   * const unsubscribe = emitter.on('change', (data) => {
   *   console.log('Changed:', data);
   * });
   * // Позже: unsubscribe();
   */
  on(event, handler) {
    if (!this._events.has(event)) {
      this._events.set(event, new Set());
    }
    this._events.get(event).add(handler);
    return () => this.off(event, handler);
  }

  /**
   * Отписаться от события
   *
   * @param {string} event - Имя события
   * @param {Function} handler - Функция-обработчик для удаления
   */
  off(event, handler) {
    const handlers = this._events.get(event);
    if (handlers) handlers.delete(handler);
  }

  /**
   * Вызвать событие (уведомить всех подписчиков)
   *
   * Обработчики вызываются синхронно в порядке подписки.
   * Ошибки в обработчиках логируются, но не прерывают вызов остальных.
   *
   * @param {string} event - Имя события
   * @param {...*} args - Аргументы для передачи обработчикам
   */
  emit(event, ...args) {
    const handlers = this._events.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (e) {
          console.error(`EventEmitter error for "${event}":`, e);
          if (this._onError) this._onError(e, event);
        }
      }
    }
  }

  /**
   * Удалить все подписки
   *
   * Используется при уничтожении компонента для предотвращения утечек памяти.
   */
  destroy() {
    this._events.clear();
  }

  /**
   * Удалить все подписки (алиас для совместимости с Node.js EventEmitter API)
   */
  removeAllListeners() {
    this._events.clear();
  }
}
