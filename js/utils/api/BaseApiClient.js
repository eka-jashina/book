/**
 * BASE API CLIENT
 *
 * Базовый HTTP-клиент: fetch, CSRF, retry, error handling.
 * Ресурсные методы подмешиваются через миксины.
 */

import { ApiError } from './ApiError.js';

/** Настройки retry по умолчанию */
const RETRY_DEFAULTS = { maxRetries: 2, initialDelay: 1000 };

/** HTTP-методы, требующие CSRF-токен */
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export class BaseApiClient {
  /**
   * @param {Object} [options]
   * @param {Function} [options.onUnauthorized] - Колбэк при 401 (показ экрана логина)
   */
  constructor({ onUnauthorized } = {}) {
    this._onUnauthorized = onUnauthorized || null;
    /** @type {string|null} CSRF-токен (lazy-загрузка при первом мутирующем запросе) */
    this._csrfToken = null;
    /** @type {Promise<string>|null} Промис текущего запроса токена (дедупликация) */
    this._csrfPromise = null;
  }

  // ═══════════════════════════════════════════
  // CSRF
  // ═══════════════════════════════════════════

  /**
   * Получить CSRF-токен (lazy, с дедупликацией параллельных вызовов)
   * @returns {Promise<string>}
   */
  async _ensureCsrfToken() {
    if (this._csrfToken) return this._csrfToken;

    if (!this._csrfPromise) {
      this._csrfPromise = (async () => {
        try {
          const res = await fetch('/api/v1/auth/csrf-token', { credentials: 'include' });
          if (!res.ok) throw new ApiError(res.status, 'Не удалось получить CSRF-токен');
          const json = await res.json();
          this._csrfToken = json.data?.token || json.token;
          return this._csrfToken;
        } finally {
          this._csrfPromise = null;
        }
      })();
    }

    return this._csrfPromise;
  }

  // ═══════════════════════════════════════════
  // Базовый fetch
  // ═══════════════════════════════════════════

  /**
   * Выполнить HTTP-запрос к API
   * @param {string} path - Путь (например '/api/v1/books')
   * @param {Object} [options] - fetch options
   * @returns {Promise<*>} Parsed JSON response
   * @throws {ApiError}
   */
  async _fetch(path, options = {}) {
    const { headers: extraHeaders, body, suppressUnauthorized, _csrfRetry, ...rest } = options;

    const headers = { ...extraHeaders };
    if (body && !(body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    // Добавить CSRF-токен для мутирующих запросов
    const method = (rest.method || 'GET').toUpperCase();
    if (CSRF_METHODS.has(method)) {
      const token = await this._ensureCsrfToken();
      if (token) headers['x-csrf-token'] = token;
    }

    let response;
    try {
      response = await fetch(path, {
        ...rest,
        headers,
        body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
        credentials: 'include',
      });
    } catch (err) {
      throw new ApiError(0, `Нет соединения с сервером: ${err.message}`);
    }

    // 403 + CSRF — токен мог протухнуть (например, после логина сессия сменилась).
    // Сбрасываем и повторяем запрос один раз с новым токеном.
    if (response.status === 403 && CSRF_METHODS.has(method) && !_csrfRetry) {
      this._csrfToken = null;
      return this._fetch(path, { ...options, _csrfRetry: true });
    }

    // 401 — не авторизован
    // suppressUnauthorized=true используется для login/register, чтобы не вызывать
    // _onUnauthorized (который предназначен для истёкших сессий, а не для неверных учётных данных)
    if (response.status === 401) {
      let message = 'Необходима авторизация';
      try {
        const errorBody = await response.json();
        if (errorBody?.message) message = errorBody.message;
      } catch { /* игнорируем ошибки парсинга */ }

      if (this._onUnauthorized && !suppressUnauthorized) {
        this._onUnauthorized();
      }
      throw new ApiError(401, message);
    }

    // 204 No Content
    if (response.status === 204) {
      return null;
    }

    // Попытаться распарсить JSON
    let data;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Для content endpoint — возвращаем текст
      data = await response.text();
    }

    if (!response.ok) {
      const message = data?.message || data?.error || `Ошибка сервера: ${response.status}`;
      const error = new ApiError(response.status, message, data?.details);

      // Сохранить Retry-After для 429 (в мс)
      if (response.status === 429) {
        const retryHeader = response.headers.get('retry-after');
        if (retryHeader) {
          const seconds = Number(retryHeader);
          error.retryAfter = Number.isFinite(seconds) ? seconds * 1000 : null;
        }
      }

      throw error;
    }

    // Unwrap standard { data } envelope from API responses
    if (data && typeof data === 'object' && 'data' in data) {
      return data.data;
    }

    return data;
  }

  /**
   * Задержка выполнения
   * @private
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _delay(ms) {
    return new Promise(resolve => { setTimeout(resolve, ms); });
  }

  /**
   * Fetch с автоматическим retry для 5xx и network-ошибок.
   * Не ретраит 4xx (клиентские ошибки) и 401 (авторизация).
   * @param {string} path
   * @param {Object} [options] - fetch options
   * @param {Object} [retryOpts] - { maxRetries, initialDelay }
   * @returns {Promise<*>}
   * @throws {ApiError}
   */
  async _fetchWithRetry(path, options = {}, retryOpts = {}) {
    const { maxRetries, initialDelay } = { ...RETRY_DEFAULTS, ...retryOpts };
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this._fetch(path, options);
      } catch (err) {
        lastError = err;

        // 429 Too Many Requests — ретраим с учётом Retry-After
        if (err.status === 429) {
          if (attempt >= maxRetries) break;
          const retryAfter = err.retryAfter || initialDelay * Math.pow(2, attempt);
          await this._delay(retryAfter);
          continue;
        }

        // Не ретраим остальные клиентские ошибки (4xx) — они не исправятся повтором
        if (err.status && err.status >= 400 && err.status < 500) {
          throw err;
        }

        // Последняя попытка — не ждём, бросаем
        if (attempt >= maxRetries) break;

        const delay = initialDelay * Math.pow(2, attempt);
        await this._delay(delay);
      }
    }

    throw lastError;
  }
}
