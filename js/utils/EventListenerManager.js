/**
 * EVENT LISTENER MANAGER
 * Централизованное управление DOM event listeners.
 */

export class EventListenerManager {
  constructor() {
    this.listeners = new Map();
    this.listenerCount = 0;
  }

  /**
   * Создать уникальный ключ для listener с учётом options.
   * Важно для корректного удаления: removeEventListener требует те же options.
   * @private
   * @param {Function} handler
   * @param {Object} options
   * @returns {string}
   */
  _createKey(handler, options) {
    // Нормализуем options для сравнения
    // capture влияет на removeEventListener, passive и once — на идентификацию listener
    if (typeof options === 'boolean') {
      return `${options}|false|false`;
    }
    const capture = !!options.capture;
    const passive = !!options.passive;
    const once = !!options.once;
    return `${capture}|${passive}|${once}`;
  }

  /**
   * Добавить event listener
   * @param {EventTarget} element
   * @param {string} eventType
   * @param {Function} handler
   * @param {Object|boolean} options
   */
  add(element, eventType, handler, options = {}) {
    if (!element) return;
    element.addEventListener(eventType, handler, options);

    if (!this.listeners.has(element)) {
      this.listeners.set(element, new Map());
    }
    const elementListeners = this.listeners.get(element);
    if (!elementListeners.has(eventType)) {
      elementListeners.set(eventType, new Map());
    }

    const handlersMap = elementListeners.get(eventType);
    const key = this._createKey(handler, options);

    // Храним по ключу: Map<key, Set<{handler, options}>>
    if (!handlersMap.has(key)) {
      handlersMap.set(key, new Set());
    }
    handlersMap.get(key).add({ handler, options });
    this.listenerCount++;
  }

  /**
   * Удалить конкретный listener
   * @param {EventTarget} element
   * @param {string} eventType
   * @param {Function} handler
   * @param {Object|boolean} options - Должны совпадать с options при add()
   */
  remove(element, eventType, handler, options = {}) {
    if (!element) return;
    element.removeEventListener(eventType, handler, options);

    const elementListeners = this.listeners.get(element);
    if (!elementListeners?.has(eventType)) return;

    const handlersMap = elementListeners.get(eventType);
    const key = this._createKey(handler, options);

    if (!handlersMap.has(key)) return;

    const handlers = handlersMap.get(key);
    for (const item of handlers) {
      if (item.handler === handler) {
        handlers.delete(item);
        this.listenerCount--;
        if (handlers.size === 0) {
          handlersMap.delete(key);
        }
        break;
      }
    }
  }

  /**
   * Удалить все listeners
   */
  clear() {
    for (const [element, eventMap] of this.listeners) {
      for (const [eventType, handlersMap] of eventMap) {
        for (const [, handlers] of handlersMap) {
          for (const { handler, options } of handlers) {
            element.removeEventListener(eventType, handler, options);
          }
        }
      }
    }
    this.listeners.clear();
    this.listenerCount = 0;
  }

  get count() {
    return this.listenerCount;
  }
}
