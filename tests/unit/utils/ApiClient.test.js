/**
 * TESTS: ApiClient
 * Тесты для HTTP API клиента
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient, ApiError } from '@utils/ApiClient.js';

// Хелпер для создания мок-ответа
function mockResponse(status, body = null, contentType = 'application/json') {
  const headers = new Map();
  headers.set('content-type', contentType);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (key) => headers.get(key) },
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

describe('ApiClient', () => {
  let client;
  let onUnauthorized;

  beforeEach(() => {
    onUnauthorized = vi.fn();
    client = new ApiClient({ onUnauthorized });
    // Мокаем _delay чтобы не ждать реальных задержек
    client._delay = vi.fn().mockResolvedValue();
    // Предустанавливаем CSRF-токен чтобы тесты не делали лишний fetch
    client._csrfToken = 'test-csrf-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ApiError
  // ═══════════════════════════════════════════════════════════════════════════

  describe('ApiError', () => {
    it('should create error with status and message', () => {
      const err = new ApiError(404, 'Not found');
      expect(err.name).toBe('ApiError');
      expect(err.status).toBe(404);
      expect(err.message).toBe('Not found');
      expect(err.details).toBeNull();
      expect(err instanceof Error).toBe(true);
    });

    it('should accept details parameter', () => {
      const details = { field: 'email' };
      const err = new ApiError(400, 'Validation', details);
      expect(err.details).toEqual(details);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should set onUnauthorized callback', () => {
      expect(client._onUnauthorized).toBe(onUnauthorized);
    });

    it('should handle missing options', () => {
      const c = new ApiClient();
      expect(c._onUnauthorized).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetch
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetch', () => {
    it('should call fetch with credentials include', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetch('/api/test');

      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        credentials: 'include',
      }));
    });

    it('should set Content-Type for JSON body', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: 'ok' }));

      await client._fetch('/api/test', { method: 'POST', body: { key: 'value' } });

      expect(global.fetch).toHaveBeenCalledWith('/api/test', expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ key: 'value' }),
      }));
    });

    it('should not set Content-Type for FormData', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: 'ok' }));
      const form = new FormData();

      await client._fetch('/api/test', { method: 'POST', body: form });

      const callHeaders = global.fetch.mock.calls[0][1].headers;
      expect(callHeaders['Content-Type']).toBeUndefined();
    });

    it('should unwrap { data } envelope', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { id: 1 } }));

      const result = await client._fetch('/api/test');
      expect(result).toEqual({ id: 1 });
    });

    it('should return null for 204 No Content', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(204));

      const result = await client._fetch('/api/test');
      expect(result).toBeNull();
    });

    it('should call onUnauthorized and throw on 401', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(401, { message: 'Unauthorized' }));

      await expect(client._fetch('/api/test')).rejects.toThrow('Unauthorized');
      expect(onUnauthorized).toHaveBeenCalled();
    });

    it('should throw on 401 without onUnauthorized callback', async () => {
      const c = new ApiClient();
      global.fetch = vi.fn().mockResolvedValue(mockResponse(401, { message: 'Unauthorized' }));

      await expect(c._fetch('/api/test')).rejects.toThrow('Unauthorized');
    });

    it('should throw ApiError on error response', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(400, { message: 'Bad request', details: { field: 'email' } })
      );

      try {
        await client._fetch('/api/test');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(400);
        expect(err.message).toBe('Bad request');
        expect(err.details).toEqual({ field: 'email' });
      }
    });

    it('should throw ApiError on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

      try {
        await client._fetch('/api/test');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect(err.status).toBe(0);
        expect(err.message).toContain('Нет соединения');
      }
    });

    it('should handle text response (non-JSON)', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, '<html>content</html>', 'text/html'));

      const result = await client._fetch('/api/test');
      expect(result).toBe('<html>content</html>');
    });

    it('should use error or status in fallback message', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(500, { error: 'Internal' }));

      try {
        await client._fetch('/api/test');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err.message).toBe('Internal');
      }
    });

    it('should handle empty body without Content-Type json header', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: 'result' }));

      const result = await client._fetch('/api/test', { method: 'GET' });
      expect(result).toBe('result');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetchWithRetry
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetchWithRetry', () => {
    it('should return result on first success', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: 'ok' }));

      const result = await client._fetchWithRetry('/api/test');
      expect(result).toBe('ok');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on 5xx errors', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce(mockResponse(500, { message: 'Server error' }))
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      const result = await client._fetchWithRetry('/api/test');
      expect(result).toBe('ok');
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(client._delay).toHaveBeenCalledWith(1000);
    });

    it('should retry on network errors', async () => {
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Network'))
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      const result = await client._fetchWithRetry('/api/test');
      expect(result).toBe('ok');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 4xx errors', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(400, { message: 'Bad request' }));

      await expect(client._fetchWithRetry('/api/test')).rejects.toThrow('Bad request');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 errors', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(401, { message: 'Unauthorized' }));

      await expect(client._fetchWithRetry('/api/test')).rejects.toThrow();
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exhausted', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(500, { message: 'Server error' }));

      await expect(client._fetchWithRetry('/api/test', {}, { maxRetries: 2 }))
        .rejects.toThrow('Server error');
      expect(global.fetch).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it('should use exponential backoff delays', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce(mockResponse(500, { message: 'err' }))
        .mockResolvedValueOnce(mockResponse(500, { message: 'err' }))
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      await client._fetchWithRetry('/api/test', {}, { maxRetries: 2, initialDelay: 1000 });

      expect(client._delay).toHaveBeenNthCalledWith(1, 1000);
      expect(client._delay).toHaveBeenNthCalledWith(2, 2000);
    });

    it('should accept custom retry options', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce(mockResponse(500, { message: 'err' }))
        .mockResolvedValueOnce(mockResponse(200, { data: 'ok' }));

      await client._fetchWithRetry('/api/test', {}, { maxRetries: 1, initialDelay: 500 });
      expect(client._delay).toHaveBeenCalledWith(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Auth methods
  // ═══════════════════════════════════════════════════════════════════════════

  describe('auth methods', () => {
    it('getMe should return user on success', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { user: { id: 1 } } }));

      const result = await client.getMe();
      expect(result).toEqual({ id: 1 });
    });

    it('getMe should return null when not authenticated', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { user: null } }));

      const result = await client.getMe();
      expect(result).toBeNull();
    });

    it('getMe should throw on non-401 errors', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(500, { message: 'Server err' }));

      await expect(client.getMe()).rejects.toThrow('Server err');
    });

    it('register should POST and return user', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(200, { data: { user: { id: 1, email: 'test@test.com' } } })
      );

      const user = await client.register('test@test.com', 'pass1234', 'Test');

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/register', expect.objectContaining({
        method: 'POST',
      }));
      expect(user).toEqual({ id: 1, email: 'test@test.com' });
    });

    it('login should POST and return user', async () => {
      global.fetch = vi.fn().mockResolvedValue(
        mockResponse(200, { data: { user: { id: 1 } } })
      );

      const user = await client.login('test@test.com', 'pass1234');
      expect(user).toEqual({ id: 1 });
    });

    it('logout should POST to logout endpoint', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(204));

      await client.logout();

      expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/logout', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Books CRUD
  // ═══════════════════════════════════════════════════════════════════════════

  describe('books', () => {
    it('getBooks should GET /api/books with retry', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: [{ id: 1 }] }));

      const result = await client.getBooks();
      expect(result).toEqual([{ id: 1 }]);
    });

    it('createBook should POST to /api/books', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { id: 1 } }));

      const result = await client.createBook({ title: 'Test' });
      expect(result).toEqual({ id: 1 });
    });

    it('getBook should GET /api/books/:id', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { id: 1, title: 'Test' } }));

      const result = await client.getBook('abc');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/abc', expect.anything());
    });

    it('updateBook should PATCH /api/books/:id', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { id: 1 } }));

      await client.updateBook('abc', { title: 'Updated' });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/abc', expect.objectContaining({
        method: 'PATCH',
      }));
    });

    it('deleteBook should DELETE /api/books/:id', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(204));

      await client.deleteBook('abc');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/abc', expect.objectContaining({
        method: 'DELETE',
      }));
    });

    it('reorderBooks should PATCH with bookIds', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: null }));

      await client.reorderBooks(['a', 'b']);
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body).toEqual({ bookIds: ['a', 'b'] });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Chapters
  // ═══════════════════════════════════════════════════════════════════════════

  describe('chapters', () => {
    it('getChapters should fetch chapters for a book', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: [] }));
      await client.getChapters('b1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/chapters', expect.anything());
    });

    it('createChapter should POST chapter data', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { id: 'c1' } }));
      const result = await client.createChapter('b1', { title: 'Ch1' });
      expect(result).toEqual({ id: 'c1' });
    });

    it('getChapter should fetch single chapter', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { id: 'c1' } }));
      await client.getChapter('b1', 'c1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/chapters/c1', expect.anything());
    });

    it('updateChapter should PATCH chapter', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { id: 'c1' } }));
      await client.updateChapter('b1', 'c1', { title: 'Updated' });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/chapters/c1', expect.objectContaining({
        method: 'PATCH',
      }));
    });

    it('deleteChapter should DELETE chapter', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(204));
      await client.deleteChapter('b1', 'c1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/chapters/c1', expect.objectContaining({
        method: 'DELETE',
      }));
    });

    it('reorderChapters should send chapterIds', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: null }));
      await client.reorderChapters('b1', ['c1', 'c2']);
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body).toEqual({ chapterIds: ['c1', 'c2'] });
    });

    it('getChapterContent should fetch content', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: '<p>Content</p>' }));
      await client.getChapterContent('b1', 'c1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/chapters/c1/content', expect.anything());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Appearance, Sounds, Ambients
  // ═══════════════════════════════════════════════════════════════════════════

  describe('appearance', () => {
    it('getAppearance should fetch appearance', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.getAppearance('b1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/appearance', expect.anything());
    });

    it('updateAppearance should PATCH appearance', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.updateAppearance('b1', { fontMin: 14 });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/appearance', expect.objectContaining({
        method: 'PATCH',
      }));
    });

    it('updateAppearanceTheme should PATCH theme', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.updateAppearanceTheme('b1', 'dark', { bgPage: '#000' });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/appearance/dark', expect.objectContaining({
        method: 'PATCH',
      }));
    });
  });

  describe('sounds', () => {
    it('getSounds should fetch sounds', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.getSounds('b1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/sounds', expect.anything());
    });

    it('updateSounds should PATCH sounds', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.updateSounds('b1', { pageFlip: 'url' });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/sounds', expect.objectContaining({
        method: 'PATCH',
      }));
    });
  });

  describe('ambients', () => {
    it('getAmbients should fetch ambients', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: [] }));
      await client.getAmbients('b1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/ambients', expect.anything());
    });

    it('createAmbient should POST ambient', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { id: 'a1' } }));
      const result = await client.createAmbient('b1', { label: 'Rain' });
      expect(result).toEqual({ id: 'a1' });
    });

    it('updateAmbient should PATCH ambient', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.updateAmbient('b1', 'a1', { label: 'Updated' });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/ambients/a1', expect.objectContaining({
        method: 'PATCH',
      }));
    });

    it('deleteAmbient should DELETE ambient', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(204));
      await client.deleteAmbient('b1', 'a1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/ambients/a1', expect.objectContaining({
        method: 'DELETE',
      }));
    });

    it('reorderAmbients should send ambientIds', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: null }));
      await client.reorderAmbients('b1', ['a1', 'a2']);
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body).toEqual({ ambientIds: ['a1', 'a2'] });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Decorative Font
  // ═══════════════════════════════════════════════════════════════════════════

  describe('decorativeFont', () => {
    it('getDecorativeFont should return data on success', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { name: 'Fancy' } }));
      const result = await client.getDecorativeFont('b1');
      expect(result).toEqual({ name: 'Fancy' });
    });

    it('getDecorativeFont should return null on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(404, { message: 'Not found' }));
      const result = await client.getDecorativeFont('b1');
      expect(result).toBeNull();
    });

    it('getDecorativeFont should throw on other errors', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(500, { message: 'Server error' }));
      await expect(client.getDecorativeFont('b1')).rejects.toThrow();
    });

    it('setDecorativeFont should PUT font data', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.setDecorativeFont('b1', { name: 'Fancy' });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/decorative-font', expect.objectContaining({
        method: 'PUT',
      }));
    });

    it('deleteDecorativeFont should DELETE font', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(204));
      await client.deleteDecorativeFont('b1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/decorative-font', expect.objectContaining({
        method: 'DELETE',
      }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Reading Fonts
  // ═══════════════════════════════════════════════════════════════════════════

  describe('reading fonts', () => {
    it('getFonts should GET /api/fonts', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: [] }));
      await client.getFonts();
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/fonts', expect.anything());
    });

    it('createFont should POST font', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { id: 'f1' } }));
      await client.createFont({ label: 'Custom' });
    });

    it('updateFont should PATCH font', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.updateFont('f1', { label: 'Updated' });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/fonts/f1', expect.objectContaining({
        method: 'PATCH',
      }));
    });

    it('deleteFont should DELETE font', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(204));
      await client.deleteFont('f1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/fonts/f1', expect.objectContaining({
        method: 'DELETE',
      }));
    });

    it('reorderFonts should send fontIds', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: null }));
      await client.reorderFonts(['f1', 'f2']);
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body).toEqual({ fontIds: ['f1', 'f2'] });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Settings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('settings', () => {
    it('getSettings should GET /api/settings', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.getSettings();
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/settings', expect.anything());
    });

    it('updateSettings should PATCH /api/settings', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.updateSettings({ fontMin: 12 });
    });

    it('getDefaultSettings should GET book default settings', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.getDefaultSettings('b1');
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/default-settings', expect.anything());
    });

    it('updateDefaultSettings should PATCH book default settings', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.updateDefaultSettings('b1', { font: 'inter' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Progress
  // ═══════════════════════════════════════════════════════════════════════════

  describe('progress', () => {
    it('getProgress should return data on success', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { page: 5 } }));
      const result = await client.getProgress('b1');
      expect(result).toEqual({ page: 5 });
    });

    it('getProgress should return null on 404', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(404, { message: 'Not found' }));
      const result = await client.getProgress('b1');
      expect(result).toBeNull();
    });

    it('getProgress should throw on other errors', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(500, { message: 'Error' }));
      await expect(client.getProgress('b1')).rejects.toThrow();
    });

    it('saveProgress should PUT progress data', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: {} }));
      await client.saveProgress('b1', { page: 10 });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/books/b1/progress', expect.objectContaining({
        method: 'PUT',
      }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Upload
  // ═══════════════════════════════════════════════════════════════════════════

  describe('upload', () => {
    it('uploadFont should POST FormData', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { url: '/fonts/x.woff2' } }));
      const file = new File(['data'], 'font.woff2');

      const result = await client.uploadFont(file);

      const body = global.fetch.mock.calls[0][1].body;
      expect(body).toBeInstanceOf(FormData);
      expect(result).toEqual({ url: '/fonts/x.woff2' });
    });

    it('uploadSound should POST FormData', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { url: '/sounds/x.mp3' } }));
      const file = new File(['data'], 'sound.mp3');

      await client.uploadSound(file);
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/upload/sound', expect.anything());
    });

    it('uploadImage should POST FormData', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { url: '/img/x.webp' } }));
      const file = new File(['data'], 'image.webp');

      await client.uploadImage(file);
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/upload/image', expect.anything());
    });

    it('uploadBook should POST FormData', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { chapters: [] } }));
      const file = new File(['data'], 'book.epub');

      await client.uploadBook(file);
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/upload/book', expect.anything());
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Export/Import, Health
  // ═══════════════════════════════════════════════════════════════════════════

  describe('export/import', () => {
    it('exportConfig should GET /api/export', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { books: [] } }));
      await client.exportConfig();
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/export', expect.anything());
    });

    it('importConfig should POST to /api/import', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: null }));
      await client.importConfig({ books: [] });
      expect(global.fetch).toHaveBeenCalledWith('/api/v1/import', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  describe('health', () => {
    it('health should GET /api/health (no retry)', async () => {
      global.fetch = vi.fn().mockResolvedValue(mockResponse(200, { data: { status: 'ok' } }));
      const result = await client.health();
      expect(result).toEqual({ status: 'ok' });
    });
  });
});
