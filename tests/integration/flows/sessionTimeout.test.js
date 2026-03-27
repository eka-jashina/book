/**
 * INTEGRATION TEST: Session Timeout
 * 401 от API → вызов onUnauthorized → навигация → повтор запроса:
 * - 401 вызывает onUnauthorized callback
 * - suppressUnauthorized=true НЕ вызывает onUnauthorized (login/register)
 * - 403 + CSRF → автоматический retry с новым токеном
 * - Retry НЕ повторяет 4xx ошибки (кроме 429)
 * - Retry повторяет 5xx с exponential backoff
 * - 429 Too Many Requests → retry с Retry-After
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseApiClient } from '../../../js/utils/api/BaseApiClient.js';
import { ApiError } from '../../../js/utils/api/ApiError.js';
import { flushPromises } from '../../helpers/testUtils.js';

/**
 * Тестовый враппер — открывает публичный доступ к HTTP-методам BaseApiClient.
 * BaseApiClient не имеет собственного публичного API: ресурсные методы
 * добавляются в подклассах. Этот враппер позволяет тестировать базовое
 * поведение (CSRF, retry, 401) без обращения к приватным полям.
 */
class TestApiClient extends BaseApiClient {
  request(path, options) {
    return this._fetch(path, options);
  }

  requestWithRetry(path, options, retryOpts) {
    return this._fetchWithRetry(path, options, retryOpts);
  }
}

describe('Session Timeout', () => {
  let client;
  let onUnauthorized;

  beforeEach(() => {
    onUnauthorized = vi.fn();
    client = new TestApiClient({ onUnauthorized });

    // По умолчанию CSRF token уже есть (не нужен запрос)
    client._csrfToken = 'test-csrf-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // 401 UNAUTHORIZED
  // ═══════════════════════════════════════════

  describe('401 Unauthorized handling', () => {
    it('should call onUnauthorized and throw ApiError on 401', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: () => Promise.resolve({ message: 'Session expired' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      await expect(client.request('/api/v1/books')).rejects.toThrow(ApiError);
      await expect(client.request('/api/v1/books')).rejects.toThrow(/Session expired|Необходима авторизация/);

      // onUnauthorized вызывается при каждом 401 — два запроса → два вызова
      expect(onUnauthorized).toHaveBeenCalledTimes(2);
    });

    it('should use default message when 401 body has no message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: () => Promise.resolve({}),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      try {
        await client.request('/api/v1/books');
      } catch (err) {
        expect(err.message).toBe('Необходима авторизация');
        expect(err.status).toBe(401);
      }

      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('should NOT call onUnauthorized when suppressUnauthorized is true', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      await expect(
        client.request('/api/v1/auth/login', {
          method: 'POST',
          body: { email: 'test@test.com', password: 'wrong' },
          suppressUnauthorized: true,
        }),
      ).rejects.toThrow('Invalid credentials');

      // onUnauthorized НЕ вызван
      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('should still throw ApiError even when no onUnauthorized callback', async () => {
      const clientNoCallback = new TestApiClient();
      clientNoCallback._csrfToken = 'token';

      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      await expect(clientNoCallback.request('/api/v1/test')).rejects.toThrow('Unauthorized');
    });

    it('should handle 401 with unparseable JSON body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: () => Promise.reject(new Error('Invalid JSON')),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      await expect(client.request('/api/v1/books')).rejects.toThrow('Необходима авторизация');
      expect(onUnauthorized).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // 403 + CSRF RETRY
  // ═══════════════════════════════════════════

  describe('403 CSRF token retry', () => {
    it('should retry with new CSRF token on 403 for mutable requests', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation((url) => {
        callCount++;

        // CSRF endpoint
        if (url.includes('csrf-token')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { token: 'new-csrf-token' } }),
            headers: new Headers({ 'content-type': 'application/json' }),
          });
        }

        // Первый запрос → 403 (протухший CSRF)
        if (callCount === 1) {
          return Promise.resolve({
            status: 403,
            ok: false,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ message: 'CSRF token invalid' }),
          });
        }

        // Retry с новым токеном → 200
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: { id: 1 } }),
        });
      });

      // Сбрасываем CSRF чтобы триггернуть _ensureCsrfToken
      client._csrfToken = 'old-token';

      const result = await client.request('/api/v1/books', { method: 'POST', body: { title: 'Test' } });

      expect(result).toEqual({ id: 1 });
      // CSRF token сброшен и заново запрошен
      expect(client._csrfToken).toBe('new-csrf-token');
    });

    it('should NOT retry 403 for GET requests', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 403,
        ok: false,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ message: 'Forbidden' }),
      });

      await expect(client.request('/api/v1/books')).rejects.toThrow('Forbidden');

      // Только один вызов fetch (без retry)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT retry 403 twice (prevent infinite loop)', async () => {
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('csrf-token')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { token: 'token' } }),
            headers: new Headers({ 'content-type': 'application/json' }),
          });
        }
        // Всегда возвращаем 403
        return Promise.resolve({
          status: 403,
          ok: false,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ message: 'Still forbidden' }),
        });
      });

      client._csrfToken = 'token';

      await expect(
        client.request('/api/v1/books', { method: 'DELETE' }),
      ).rejects.toThrow('Still forbidden');

      // 2 вызова books (оригинал + 1 retry), не бесконечный цикл
      const bookCalls = global.fetch.mock.calls.filter(([url]) => url.includes('books'));
      expect(bookCalls.length).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // FETCH WITH RETRY (5xx, network errors)
  // ═══════════════════════════════════════════

  describe('Retry with exponential backoff', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry on 5xx server error', async () => {
      let attempt = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        attempt++;
        if (attempt < 3) {
          return Promise.resolve({
            status: 500,
            ok: false,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ message: 'Internal Server Error' }),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: { success: true } }),
        });
      });

      const resultPromise = client.requestWithRetry('/api/v1/books');

      // Продвигаем таймеры для retry delays
      await vi.advanceTimersByTimeAsync(1000); // первый delay
      await flushPromises();
      await vi.advanceTimersByTimeAsync(2000); // второй delay
      await flushPromises();

      const result = await resultPromise;

      expect(result).toEqual({ success: true });
      expect(attempt).toBe(3);
    });

    it('should NOT retry on 4xx client errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
        json: () => Promise.resolve({ message: 'Unauthorized' }),
        headers: new Headers({ 'content-type': 'application/json' }),
      });

      await expect(
        client.requestWithRetry('/api/v1/books'),
      ).rejects.toThrow(ApiError);

      // Только один вызов (без retry)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on network errors', async () => {
      let attempt = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        attempt++;
        if (attempt === 1) {
          return Promise.reject(new Error('Network failure'));
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: 'ok' }),
        });
      });

      const resultPromise = client.requestWithRetry('/api/v1/books');

      await vi.advanceTimersByTimeAsync(1500);
      await flushPromises();

      const result = await resultPromise;

      expect(result).toBe('ok');
      expect(attempt).toBe(2);
    });

    it('should throw after max retries exhausted', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          status: 502,
          ok: false,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ message: 'Bad Gateway' }),
        });
      });

      const resultPromise = client.requestWithRetry('/api/v1/books', {}, { maxRetries: 2, initialDelay: 100 });
      resultPromise.catch(() => {}); // предотвращаем unhandled rejection

      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(500);
        await flushPromises();
      }

      await expect(resultPromise).rejects.toThrow('Bad Gateway');
      expect(global.fetch).toHaveBeenCalledTimes(3); // original + 2 retries
    });
  });

  // ═══════════════════════════════════════════
  // 429 RATE LIMITING
  // ═══════════════════════════════════════════

  describe('429 Too Many Requests', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should retry with Retry-After header on 429', async () => {
      let attempt = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        attempt++;
        if (attempt === 1) {
          return Promise.resolve({
            status: 429,
            ok: false,
            headers: new Headers({
              'content-type': 'application/json',
              'retry-after': '2',
            }),
            json: () => Promise.resolve({ message: 'Too many requests' }),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: 'success' }),
        });
      });

      const resultPromise = client.requestWithRetry('/api/v1/books');

      // Retry-After: 2 секунды → 2000 мс
      await vi.advanceTimersByTimeAsync(2500);
      await flushPromises();

      const result = await resultPromise;

      expect(result).toBe('success');
      expect(attempt).toBe(2);
    });
  });

  // ═══════════════════════════════════════════
  // NETWORK ERRORS
  // ═══════════════════════════════════════════

  describe('Network errors', () => {
    it('should wrap network error in ApiError with status 0', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('DNS resolution failed'));

      try {
        await client.request('/api/v1/books');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(0);
        expect(err.message).toContain('DNS resolution failed');
      }
    });
  });

  // ═══════════════════════════════════════════
  // CSRF TOKEN LAZY LOADING
  // ═══════════════════════════════════════════

  describe('CSRF token management', () => {
    it('should fetch CSRF token lazily on first mutable request', async () => {
      client._csrfToken = null; // сбрасываем

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('csrf-token')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { token: 'lazy-token' } }),
            headers: new Headers({ 'content-type': 'application/json' }),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: 'created' }),
        });
      });

      await client.request('/api/v1/books', { method: 'POST', body: { title: 'New' } });

      expect(client._csrfToken).toBe('lazy-token');

      // Второй запрос — не запрашивает CSRF повторно
      global.fetch.mockClear();

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: 'updated' }),
      });

      await client.request('/api/v1/books/1', { method: 'PUT', body: { title: 'Updated' } });

      // Только один вызов (PUT, без csrf-token)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT fetch CSRF token for GET requests', async () => {
      client._csrfToken = null;

      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: [] }),
      });

      await client.request('/api/v1/books');

      // Только один вызов (GET), без csrf-token запроса
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books', expect.any(Object));
      expect(client._csrfToken).toBeNull();
    });

    it('should deduplicate parallel CSRF token requests', async () => {
      client._csrfToken = null;
      let csrfRequestCount = 0;

      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('csrf-token')) {
          csrfRequestCount++;
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ data: { token: 'dedup-token' } }),
            headers: new Headers({ 'content-type': 'application/json' }),
          });
        }
        return Promise.resolve({
          status: 200,
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({ data: 'ok' }),
        });
      });

      // Два параллельных мутирующих запроса
      const [r1, r2] = await Promise.all([
        client.request('/api/v1/books', { method: 'POST', body: { a: 1 } }),
        client.request('/api/v1/books', { method: 'POST', body: { b: 2 } }),
      ]);

      // CSRF запрошен только один раз (дедупликация)
      expect(csrfRequestCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // RESPONSE FORMATS
  // ═══════════════════════════════════════════

  describe('Response parsing', () => {
    it('should unwrap { data } envelope', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({ data: { books: [] } }),
      });

      const result = await client.request('/api/v1/books');
      expect(result).toEqual({ books: [] });
    });

    it('should return null for 204 No Content', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 204,
        ok: true,
        headers: new Headers(),
      });

      const result = await client.request('/api/v1/books/1', { method: 'DELETE' });
      expect(result).toBeNull();
    });

    it('should return text for non-JSON content', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: () => Promise.resolve('<article>Chapter content</article>'),
      });

      const result = await client.request('/api/v1/books/1/chapters/1/content');
      expect(result).toBe('<article>Chapter content</article>');
    });
  });
});
