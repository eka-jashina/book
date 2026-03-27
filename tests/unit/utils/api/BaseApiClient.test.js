/**
 * TESTS: BaseApiClient
 * Тесты для базового HTTP-клиента (fetch, CSRF, retry)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BaseApiClient } from '@utils/api/BaseApiClient.js';
import { ApiError } from '@utils/api/ApiError.js';

// ═══════════════════════════════════════════════════════════════════════════
// ХЕЛПЕРЫ
// ═══════════════════════════════════════════════════════════════════════════

/** Создать мок fetch-ответа */
function mockResponse(status, body = null, contentType = 'application/json') {
  const headersMap = new Map();
  headersMap.set('content-type', contentType);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key) => headersMap.get(key.toLowerCase()) },
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

/** Создать мок fetch-ответа с retry-after */
function mockResponse429(retryAfter = '2') {
  const headersMap = new Map();
  headersMap.set('content-type', 'application/json');
  headersMap.set('retry-after', retryAfter);
  return {
    ok: false,
    status: 429,
    headers: { get: (key) => headersMap.get(key.toLowerCase()) },
    json: vi.fn().mockResolvedValue({ message: 'Too many requests' }),
    text: vi.fn().mockResolvedValue('Too many requests'),
  };
}

describe('BaseApiClient', () => {
  let client;
  let onUnauthorized;

  beforeEach(() => {
    onUnauthorized = vi.fn();
    client = new BaseApiClient({ onUnauthorized });
    // Мокаем _delay чтобы тесты не ждали таймауты
    client._delay = vi.fn().mockResolvedValue();
    // Предустанавливаем CSRF-токен для большинства тестов
    client._csrfToken = 'test-csrf-token';
    // Мокаем глобальный fetch
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // КОНСТРУКТОР
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('должен сохранить колбэк onUnauthorized', () => {
      expect(client._onUnauthorized).toBe(onUnauthorized);
    });

    it('должен установить onUnauthorized = null по умолчанию', () => {
      const c = new BaseApiClient();
      expect(c._onUnauthorized).toBeNull();
    });

    it('должен инициализировать csrfToken как null', () => {
      const c = new BaseApiClient();
      expect(c._csrfToken).toBeNull();
    });

    it('должен инициализировать csrfPromise как null', () => {
      const c = new BaseApiClient();
      expect(c._csrfPromise).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _ensureCsrfToken
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_ensureCsrfToken()', () => {
    it('должен вернуть кешированный токен если есть', async () => {
      client._csrfToken = 'cached-token';
      const token = await client._ensureCsrfToken();
      expect(token).toBe('cached-token');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('должен запросить токен с сервера если кеш пуст', async () => {
      client._csrfToken = null;
      fetch.mockResolvedValue(mockResponse(200, { data: { token: 'new-token' } }));

      const token = await client._ensureCsrfToken();

      expect(fetch).toHaveBeenCalledWith('/api/v1/auth/csrf-token', { credentials: 'include' });
      expect(token).toBe('new-token');
      expect(client._csrfToken).toBe('new-token');
    });

    it('должен поддерживать формат ответа { token }', async () => {
      client._csrfToken = null;
      fetch.mockResolvedValue(mockResponse(200, { token: 'flat-token' }));

      const token = await client._ensureCsrfToken();
      expect(token).toBe('flat-token');
    });

    it('должен дедуплицировать параллельные запросы', async () => {
      client._csrfToken = null;
      let resolvePromise;
      fetch.mockReturnValue(new Promise((resolve) => {
        resolvePromise = resolve;
      }));

      const p1 = client._ensureCsrfToken();
      const p2 = client._ensureCsrfToken();

      resolvePromise(mockResponse(200, { data: { token: 'dedup-token' } }));

      const [t1, t2] = await Promise.all([p1, p2]);
      expect(t1).toBe('dedup-token');
      expect(t2).toBe('dedup-token');
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('должен бросить ApiError при ошибке сервера', async () => {
      client._csrfToken = null;
      fetch.mockResolvedValue(mockResponse(500));

      await expect(client._ensureCsrfToken()).rejects.toThrow(ApiError);
    });

    it('должен очистить _csrfPromise после завершения (успех)', async () => {
      client._csrfToken = null;
      fetch.mockResolvedValue(mockResponse(200, { data: { token: 't' } }));

      await client._ensureCsrfToken();
      expect(client._csrfPromise).toBeNull();
    });

    it('должен очистить _csrfPromise после завершения (ошибка)', async () => {
      client._csrfToken = null;
      fetch.mockResolvedValue(mockResponse(500));

      try { await client._ensureCsrfToken(); } catch { /* ожидаемая ошибка */ }
      expect(client._csrfPromise).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetch — Content-Type и заголовки
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetch() — заголовки и тело', () => {
    it('должен установить Content-Type: application/json для JSON-тела', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetch('/api/test', { method: 'POST', body: { key: 'value' } });

      const [, opts] = fetch.mock.calls[0];
      expect(opts.headers['Content-Type']).toBe('application/json');
    });

    it('не должен устанавливать Content-Type для FormData', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));
      const form = new FormData();

      await client._fetch('/api/test', { method: 'POST', body: form });

      const [, opts] = fetch.mock.calls[0];
      expect(opts.headers['Content-Type']).toBeUndefined();
    });

    it('должен сериализовать тело в JSON', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));
      const body = { name: 'test' };

      await client._fetch('/api/test', { method: 'POST', body });

      const [, opts] = fetch.mock.calls[0];
      expect(opts.body).toBe(JSON.stringify(body));
    });

    it('должен передать FormData как есть', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));
      const form = new FormData();
      form.append('file', 'data');

      await client._fetch('/api/test', { method: 'POST', body: form });

      const [, opts] = fetch.mock.calls[0];
      expect(opts.body).toBe(form);
    });

    it('должен отправлять credentials: include', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetch('/api/test');

      const [, opts] = fetch.mock.calls[0];
      expect(opts.credentials).toBe('include');
    });

    it('должен передавать дополнительные заголовки', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetch('/api/test', { headers: { 'X-Custom': 'value' } });

      const [, opts] = fetch.mock.calls[0];
      expect(opts.headers['X-Custom']).toBe('value');
    });

    it('не должен отправлять body = undefined для GET-запросов', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetch('/api/test');

      const [, opts] = fetch.mock.calls[0];
      expect(opts.body).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetch — CSRF
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetch() — CSRF-токен', () => {
    it('должен добавить x-csrf-token для POST', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetch('/api/test', { method: 'POST', body: {} });

      const [, opts] = fetch.mock.calls[0];
      expect(opts.headers['x-csrf-token']).toBe('test-csrf-token');
    });

    it.each(['PUT', 'PATCH', 'DELETE'])('должен добавить x-csrf-token для %s', async (method) => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetch('/api/test', { method, body: {} });

      const [, opts] = fetch.mock.calls[0];
      expect(opts.headers['x-csrf-token']).toBe('test-csrf-token');
    });

    it('не должен добавлять x-csrf-token для GET', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetch('/api/test');

      const [, opts] = fetch.mock.calls[0];
      expect(opts.headers['x-csrf-token']).toBeUndefined();
    });

    it('должен повторить запрос с новым токеном при 403 на CSRF-метод', async () => {
      const response403 = mockResponse(403, { message: 'CSRF mismatch' });
      const response200 = mockResponse(200, { data: 'success' });
      fetch
        .mockResolvedValueOnce(response403)
        .mockResolvedValueOnce(mockResponse(200, { data: { token: 'fresh-token' } }))
        .mockResolvedValueOnce(response200);

      // Сбрасываем CSRF чтобы _ensureCsrfToken запросил новый
      client._csrfToken = 'old-token';

      const result = await client._fetch('/api/test', { method: 'POST', body: {} });

      expect(result).toBe('success');
    });

    it('не должен зацикливаться при повторном 403', async () => {
      const response403 = mockResponse(403, { message: 'Forbidden' });
      fetch.mockResolvedValue(response403);

      // Первый вызов → 403 → сброс токена → повтор → 403 → ошибка
      await expect(client._fetch('/api/test', { method: 'POST', body: {} }))
        .rejects.toThrow(ApiError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetch — 401
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetch() — 401 Unauthorized', () => {
    it('должен вызвать onUnauthorized при 401', async () => {
      fetch.mockResolvedValue(mockResponse(401, { message: 'Unauthorized' }));

      await expect(client._fetch('/api/test')).rejects.toThrow(ApiError);
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('должен бросить ApiError(401)', async () => {
      fetch.mockResolvedValue(mockResponse(401, { message: 'Unauthorized' }));

      const err = await client._fetch('/api/test').catch(e => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(401);
    });

    it('не должен вызывать onUnauthorized при suppressUnauthorized', async () => {
      fetch.mockResolvedValue(mockResponse(401, { message: 'Bad credentials' }));

      await expect(
        client._fetch('/api/test', { method: 'POST', body: {}, suppressUnauthorized: true })
      ).rejects.toThrow(ApiError);

      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('не должен вызывать onUnauthorized если колбэк не задан', async () => {
      const c = new BaseApiClient();
      c._csrfToken = 'token';
      fetch.mockResolvedValue(mockResponse(401, { message: 'Unauthorized' }));

      await expect(c._fetch('/api/test')).rejects.toThrow(ApiError);
      // Не должно быть ошибки вызова null()
    });

    it('должен извлечь сообщение из тела ответа 401', async () => {
      fetch.mockResolvedValue(mockResponse(401, { message: 'Token expired' }));

      const err = await client._fetch('/api/test').catch(e => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe('Token expired');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetch — 204 No Content
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetch() — 204 No Content', () => {
    it('должен вернуть null при 204', async () => {
      fetch.mockResolvedValue(mockResponse(204));

      const result = await client._fetch('/api/test', { method: 'DELETE' });
      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetch — парсинг ответа
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetch() — парсинг ответа', () => {
    it('должен распарсить JSON при content-type: application/json', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: { id: 1 } }));

      const result = await client._fetch('/api/test');
      expect(result).toEqual({ id: 1 });
    });

    it('должен вернуть текст при не-JSON content-type', async () => {
      fetch.mockResolvedValue(mockResponse(200, '<h1>Hello</h1>', 'text/html'));

      const result = await client._fetch('/api/test');
      expect(result).toBe('<h1>Hello</h1>');
    });

    it('должен развернуть { data } конверт', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: { books: [] } }));

      const result = await client._fetch('/api/test');
      expect(result).toEqual({ books: [] });
    });

    it('должен вернуть ответ как есть если нет data-конверта', async () => {
      fetch.mockResolvedValue(mockResponse(200, { status: 'ok' }));

      const result = await client._fetch('/api/test');
      expect(result).toEqual({ status: 'ok' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetch — ошибки HTTP
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetch() — HTTP-ошибки', () => {
    it('должен бросить ApiError при ошибке сервера', async () => {
      fetch.mockResolvedValue(mockResponse(500, { message: 'Internal error' }));

      const err = await client._fetch('/api/test').catch(e => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(500);
      expect(err.message).toBe('Internal error');
    });

    it('должен использовать error из тела ответа', async () => {
      fetch.mockResolvedValue(mockResponse(400, { error: 'Bad request' }));

      const err = await client._fetch('/api/test').catch(e => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe('Bad request');
    });

    it('должен сохранить details из тела ошибки', async () => {
      const details = [{ field: 'email', message: 'required' }];
      fetch.mockResolvedValue(mockResponse(422, { message: 'Validation', details }));

      const err = await client._fetch('/api/test').catch(e => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.details).toEqual(details);
    });

    it('должен установить retryAfter при 429', async () => {
      fetch.mockResolvedValue(mockResponse429('3'));

      const err = await client._fetch('/api/test').catch(e => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(429);
      expect(err.retryAfter).toBe(3000);
    });

    it('должен установить retryAfter = null при невалидном retry-after', async () => {
      fetch.mockResolvedValue(mockResponse429('invalid'));

      const err = await client._fetch('/api/test').catch(e => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.retryAfter).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetch — Network error
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetch() — сетевые ошибки', () => {
    it('должен бросить ApiError(0) при network error', async () => {
      fetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const err = await client._fetch('/api/test').catch(e => e);
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(0);
      expect(err.message).toContain('Failed to fetch');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _delay
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_delay()', () => {
    it('должен вернуть Promise', () => {
      // Используем оригинальный _delay
      const c = new BaseApiClient();
      vi.useFakeTimers();
      const p = c._delay(100);
      expect(p).toBeInstanceOf(Promise);
      vi.advanceTimersByTime(100);
      vi.useRealTimers();
    });

    it('должен резолвиться после указанной задержки', async () => {
      const c = new BaseApiClient();
      vi.useFakeTimers();
      let resolved = false;
      c._delay(500).then(() => { resolved = true; });

      vi.advanceTimersByTime(499);
      await Promise.resolve();
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(1);
      await Promise.resolve();
      expect(resolved).toBe(true);
      vi.useRealTimers();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetchWithRetry — успешный запрос
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetchWithRetry() — успех', () => {
    it('должен вернуть результат при успешном запросе', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: { id: 1 } }));

      const result = await client._fetchWithRetry('/api/test');
      expect(result).toEqual({ id: 1 });
    });

    it('не должен ретраить при успехе', async () => {
      fetch.mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetchWithRetry('/api/test');
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetchWithRetry — retry при 5xx
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetchWithRetry() — retry при 5xx', () => {
    it('должен повторить запрос при 500', async () => {
      fetch
        .mockResolvedValueOnce(mockResponse(500, { message: 'Error' }))
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      const result = await client._fetchWithRetry('/api/test');
      expect(result).toBe('ok');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('должен повторить до maxRetries раз', async () => {
      fetch
        .mockResolvedValueOnce(mockResponse(502, { message: 'Error' }))
        .mockResolvedValueOnce(mockResponse(503, { message: 'Error' }))
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      const result = await client._fetchWithRetry('/api/test', {}, { maxRetries: 2 });
      expect(result).toBe('ok');
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('должен бросить ошибку после исчерпания retry', async () => {
      fetch.mockResolvedValue(mockResponse(500, { message: 'Server error' }));

      await expect(
        client._fetchWithRetry('/api/test', {}, { maxRetries: 2 })
      ).rejects.toThrow(ApiError);

      // 1 initial + 2 retries = 3
      expect(fetch).toHaveBeenCalledTimes(3);
    });

    it('должен использовать экспоненциальный backoff', async () => {
      fetch
        .mockResolvedValueOnce(mockResponse(500, { message: 'Error' }))
        .mockResolvedValueOnce(mockResponse(500, { message: 'Error' }))
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      await client._fetchWithRetry('/api/test', {}, { maxRetries: 2, initialDelay: 100 });

      // attempt 0: delay = 100 * 2^0 = 100
      // attempt 1: delay = 100 * 2^1 = 200
      expect(client._delay).toHaveBeenCalledWith(100);
      expect(client._delay).toHaveBeenCalledWith(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetchWithRetry — НЕ ретраит 4xx
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetchWithRetry() — не ретраит 4xx', () => {
    it('не должен ретраить 400', async () => {
      fetch.mockResolvedValue(mockResponse(400, { message: 'Bad request' }));

      await expect(client._fetchWithRetry('/api/test')).rejects.toThrow(ApiError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('не должен ретраить 404', async () => {
      fetch.mockResolvedValue(mockResponse(404, { message: 'Not found' }));

      await expect(client._fetchWithRetry('/api/test')).rejects.toThrow(ApiError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('не должен ретраить 422', async () => {
      fetch.mockResolvedValue(mockResponse(422, { message: 'Unprocessable' }));

      await expect(client._fetchWithRetry('/api/test')).rejects.toThrow(ApiError);
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetchWithRetry — 429 Too Many Requests
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetchWithRetry() — 429', () => {
    it('должен ретраить 429 с retry-after', async () => {
      fetch
        .mockResolvedValueOnce(mockResponse429('2'))
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      const result = await client._fetchWithRetry('/api/test');
      expect(result).toBe('ok');
      expect(client._delay).toHaveBeenCalledWith(2000);
    });

    it('должен использовать exponential backoff если retryAfter отсутствует', async () => {
      // 429 без retry-after заголовка
      const resp429 = {
        ok: false,
        status: 429,
        headers: { get: () => null },
        json: vi.fn().mockResolvedValue({ message: 'Rate limited' }),
        text: vi.fn().mockResolvedValue('Rate limited'),
      };

      fetch
        .mockResolvedValueOnce(resp429)
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      await client._fetchWithRetry('/api/test', {}, { initialDelay: 500 });

      // attempt 0: 500 * 2^0 = 500
      expect(client._delay).toHaveBeenCalledWith(500);
    });

    it('должен бросить после исчерпания retry при 429', async () => {
      fetch.mockResolvedValue(mockResponse429('1'));

      await expect(
        client._fetchWithRetry('/api/test', {}, { maxRetries: 1 })
      ).rejects.toThrow(ApiError);

      // 1 initial + 1 retry = 2
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetchWithRetry — Network error
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetchWithRetry() — сетевые ошибки', () => {
    it('должен ретраить при сетевой ошибке', async () => {
      fetch
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      const result = await client._fetchWithRetry('/api/test');
      expect(result).toBe('ok');
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('должен бросить после исчерпания retry при сетевой ошибке', async () => {
      fetch.mockRejectedValue(new TypeError('Network error'));

      await expect(
        client._fetchWithRetry('/api/test', {}, { maxRetries: 1 })
      ).rejects.toThrow(ApiError);

      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetchWithRetry — пользовательские параметры retry
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetchWithRetry() — параметры retry', () => {
    it('должен принимать пользовательские maxRetries', async () => {
      fetch.mockResolvedValue(mockResponse(500, { message: 'Error' }));

      await expect(
        client._fetchWithRetry('/api/test', {}, { maxRetries: 0 })
      ).rejects.toThrow(ApiError);

      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('должен использовать default maxRetries = 2', async () => {
      fetch.mockResolvedValue(mockResponse(500, { message: 'Error' }));

      await expect(client._fetchWithRetry('/api/test')).rejects.toThrow(ApiError);

      expect(fetch).toHaveBeenCalledTimes(3);
    });
  });
});
