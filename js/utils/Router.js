/**
 * Лёгкий SPA-роутер на History API.
 *
 * Маршруты:
 *   /              → bookshelf (или landing для гостей)
 *   /book/:bookId  → ридер
 *   /embed/:bookId → встраиваемый ридер (будущее)
 *   /:username     → публичный шкаф (будущее)
 *   /account       → личный кабинет (будущее)
 *
 * Определённые маршруты (/, /book/*, /embed/*, /account) матчатся первыми.
 * /:username — catch-all для всех остальных top-level путей.
 */

const BASE_URL = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

/**
 * @typedef {Object} Route
 * @property {string} name        — уникальное имя маршрута
 * @property {RegExp} pattern     — скомпилированный RegExp
 * @property {string[]} paramKeys — имена параметров из паттерна
 */

/**
 * @typedef {Object} RouteMatch
 * @property {string} name   — имя маршрута
 * @property {Object} params — извлечённые параметры
 * @property {string} path   — полный путь (без base)
 * @property {URLSearchParams} query — query-параметры
 */

export class Router {
  /**
   * @param {Array<{name: string, path: string, handler: function}>} routes
   *   Маршруты в порядке приоритета (первый матч побеждает).
   *   path: '/book/:bookId', '/embed/:bookId', '/', '/:username'
   *   handler: async (params, context) => void
   */
  constructor(routes) {
    /** @type {Route[]} */
    this._routes = routes.map(({ name, path, handler }) => {
      const { pattern, paramKeys } = this._compilePath(path);
      return { name, pattern, paramKeys, handler };
    });

    /** @type {RouteMatch|null} */
    this._current = null;

    /** @type {boolean} */
    this._started = false;

    this._onPopState = this._onPopState.bind(this);
    this._onClick = this._onClick.bind(this);
  }

  /**
   * Компиляция path-шаблона в RegExp.
   * '/book/:bookId' → /^\/book\/([^/]+)$/
   */
  _compilePath(path) {
    const paramKeys = [];
    const segments = path.split('/').filter(Boolean);
    const parts = segments.map((seg) => {
      if (seg.startsWith(':')) {
        paramKeys.push(seg.slice(1));
        return '([^/]+)';
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    const regexStr = parts.length === 0 ? '^/$' : `^/${parts.join('/')}$`;
    return { pattern: new RegExp(regexStr), paramKeys };
  }

  /**
   * Матчинг пути (без base) к маршрутам.
   * @param {string} path
   * @returns {RouteMatch|null}
   */
  _match(path) {
    for (const route of this._routes) {
      const match = path.match(route.pattern);
      if (match) {
        const params = {};
        route.paramKeys.forEach((key, i) => {
          params[key] = decodeURIComponent(match[i + 1]);
        });
        return { name: route.name, params, path };
      }
    }
    return null;
  }

  /**
   * Убрать base prefix из полного URL path.
   * /flipbook/book/123 → /book/123
   * /book/123 → /book/123 (если base = /)
   */
  _stripBase(fullPath) {
    if (BASE_URL && fullPath.startsWith(BASE_URL)) {
      const stripped = fullPath.slice(BASE_URL.length);
      return stripped.startsWith('/') ? stripped : `/${stripped}`;
    }
    return fullPath;
  }

  /**
   * Добавить base prefix.
   * /book/123 → /flipbook/book/123
   */
  _addBase(path) {
    return BASE_URL + path;
  }

  /**
   * Запустить роутер — обработать текущий URL и слушать навигацию.
   * @param {Object} [context] — контекст, передаваемый в обработчики
   */
  async start(context = {}) {
    if (this._started) return;
    this._started = true;
    this._context = context;

    window.addEventListener('popstate', this._onPopState);
    document.addEventListener('click', this._onClick);

    await this._resolve(this._stripBase(location.pathname), location.search);
  }

  /**
   * Навигация к новому пути (может содержать query string).
   * @param {string} pathWithQuery — путь без base (напр. '/book/123' или '/account?tab=profile')
   * @param {Object} [options]
   * @param {boolean} [options.replace=false] — заменить текущую запись
   */
  async navigate(pathWithQuery, { replace = false } = {}) {
    if (!this._started) return;

    // Отделяем path от query string
    const qIdx = pathWithQuery.indexOf('?');
    const path = qIdx >= 0 ? pathWithQuery.slice(0, qIdx) : pathWithQuery;
    const search = qIdx >= 0 ? pathWithQuery.slice(qIdx) : '';

    const fullPath = this._addBase(path) + search;

    if (replace) {
      history.replaceState(null, '', fullPath);
    } else {
      history.pushState(null, '', fullPath);
    }

    await this._resolve(path, search);
  }

  /**
   * Получить текущий маршрут.
   * @returns {RouteMatch|null}
   */
  getCurrentRoute() {
    return this._current;
  }

  /**
   * Резолв пути: найти маршрут и вызвать обработчик.
   * @param {string} path — путь без base и query string
   * @param {string} [search=''] — query string (напр. '?tab=profile')
   */
  async _resolve(path, search = '') {
    // Нормализация: убрать trailing slash (кроме /)
    const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');

    const match = this._match(normalizedPath);

    if (!match) {
      // Нет совпадения — fallback на главную
      console.warn(`[Router] No route matched for: ${normalizedPath}, falling back to /`);
      await this.navigate('/', { replace: true });
      return;
    }

    // Сохраняем query params в match для доступа из обработчиков
    match.query = new URLSearchParams(search);
    this._current = match;

    // Найти маршрут и вызвать handler
    const route = this._routes.find((r) => r.name === match.name);
    if (route?.handler) {
      try {
        await route.handler(match.params, this._context);
      } catch (err) {
        console.error(`[Router] Error in handler for ${match.name}:`, err);
      }
    }
  }

  /** @private */
  _onPopState() {
    this._resolve(this._stripBase(location.pathname), location.search);
  }

  /**
   * Перехват кликов по ссылкам с data-route атрибутом.
   * <a data-route="/book/123">...</a>
   * @private
   */
  _onClick(event) {
    const link = event.target.closest('a[data-route]');
    if (!link) return;

    event.preventDefault();
    const path = link.getAttribute('data-route');
    if (path) this.navigate(path);
  }

  /**
   * Остановить роутер, убрать слушатели.
   */
  destroy() {
    this._started = false;
    window.removeEventListener('popstate', this._onPopState);
    document.removeEventListener('click', this._onClick);
    this._current = null;
  }
}
