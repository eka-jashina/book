/**
 * MEDIA QUERY MANAGER
 * Реактивное отслеживание media queries.
 *
 * Особенности:
 * - Именованные media queries для удобства доступа
 * - Автоматическое уведомление подписчиков при изменении
 * - Паттерн Observer для реактивности
 * - Глобальный синглтон с предустановкой "mobile"
 */

class MediaQueryManager {
  constructor() {
    /** @type {Map<string, MediaQueryList>} Зарегистрированные запросы */
    this._queries = new Map();
    /** @type {Map<string, Function>} Функции отписки от change-событий */
    this._unsubscribers = new Map();
    /** @type {Set<Function>} Подписчики на изменения */
    this._listeners = new Set();
  }

  /**
   * Зарегистрировать media query под именем
   * @param {string} name - Уникальное имя запроса (например, 'mobile')
   * @param {string} query - CSS media query (например, '(max-width: 768px)')
   * @returns {Function} Функция для отписки от события change
   */
  register(name, query) {
    // Удаляем предыдущий listener, если запрос с таким именем уже существует
    if (this._unsubscribers.has(name)) {
      this._unsubscribers.get(name)();
      this._unsubscribers.delete(name);
    }

    const mql = window.matchMedia(query);
    this._queries.set(name, mql);

    const handler = () => this._notifyListeners();
    mql.addEventListener("change", handler);

    const unsubscribe = () => mql.removeEventListener("change", handler);
    this._unsubscribers.set(name, unsubscribe);

    return unsubscribe;
  }

  /**
   * Проверить текущее состояние media query
   * @param {string} name - Имя зарегистрированного запроса
   * @returns {boolean} true если media query активен
   */
  get(name) {
    const mql = this._queries.get(name);
    return mql ? mql.matches : false;
  }

  /**
   * Проверить, активен ли мобильный режим
   * @returns {boolean} true если ширина экрана <= 768px
   */
  get isMobile() {
    return this.get("mobile");
  }

  /**
   * Подписаться на изменения любого media query
   * @param {Function} listener - Функция-обработчик
   * @returns {Function} Функция отписки
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Уведомить всех подписчиков об изменении
   * @private
   */
  _notifyListeners() {
    for (const listener of this._listeners) {
      try {
        listener();
      } catch (e) {
        console.error("MediaQueryManager listener error:", e);
      }
    }
  }

  /**
   * Очистить все запросы и подписчиков
   */
  destroy() {
    for (const unsubscribe of this._unsubscribers.values()) {
      unsubscribe();
    }
    this._unsubscribers.clear();
    this._queries.clear();
    this._listeners.clear();
  }
}

export const mediaQueries = new MediaQueryManager();
mediaQueries.register("mobile", "(max-width: 768px)");

export { MediaQueryManager };
