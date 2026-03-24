/**
 * TESTS: FontsApi
 * Тесты для миксина управления шрифтами (декоративные + для чтения)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient, ApiError } from '@utils/ApiClient.js';

describe('FontsApi', () => {
  let client;
  const bookId = 'book-1';

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ДЕКОРАТИВНЫЙ ШРИФТ
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getDecorativeFont()', () => {
    it('должен запросить декоративный шрифт книги', async () => {
      const font = { id: 'f-1', family: 'Lobster' };
      client._fetchWithRetry.mockResolvedValue(font);

      const result = await client.getDecorativeFont(bookId);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/decorative-font`);
      expect(result).toEqual(font);
    });

    it('должен вернуть null при 404', async () => {
      client._fetchWithRetry.mockRejectedValue(new ApiError(404, 'Not found'));

      const result = await client.getDecorativeFont(bookId);

      expect(result).toBeNull();
    });

    it('должен пробросить другие ошибки', async () => {
      client._fetchWithRetry.mockRejectedValue(new ApiError(500, 'Server error'));

      await expect(client.getDecorativeFont(bookId)).rejects.toThrow(ApiError);
    });
  });

  describe('setDecorativeFont()', () => {
    it('должен отправить PUT для установки декоративного шрифта', async () => {
      const data = { family: 'Lobster', url: '/fonts/lobster.woff2' };
      client._fetchWithRetry.mockResolvedValue({ id: 'f-1', ...data });

      await client.setDecorativeFont(bookId, data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/decorative-font`,
        { method: 'PUT', body: data },
      );
    });
  });

  describe('deleteDecorativeFont()', () => {
    it('должен отправить DELETE', async () => {
      client._fetchWithRetry.mockResolvedValue(null);

      await client.deleteDecorativeFont(bookId);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/decorative-font`,
        { method: 'DELETE' },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ШРИФТЫ ДЛЯ ЧТЕНИЯ
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getFonts()', () => {
    it('должен запросить список шрифтов', async () => {
      const fonts = [{ id: '1', family: 'Arial' }];
      client._fetchWithRetry.mockResolvedValue(fonts);

      const result = await client.getFonts();

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/fonts');
      expect(result).toEqual(fonts);
    });
  });

  describe('createFont()', () => {
    it('должен отправить POST для создания шрифта', async () => {
      const data = { label: 'My Font', family: 'MyFont', url: '/fonts/my.woff2' };
      client._fetchWithRetry.mockResolvedValue({ id: '1', ...data });

      await client.createFont(data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/fonts', {
        method: 'POST',
        body: data,
      });
    });
  });

  describe('updateFont()', () => {
    it('должен отправить PATCH для обновления шрифта', async () => {
      const data = { label: 'Updated Font' };
      client._fetchWithRetry.mockResolvedValue({ id: 'f-1', ...data });

      await client.updateFont('f-1', data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/fonts/f-1', {
        method: 'PATCH',
        body: data,
      });
    });
  });

  describe('deleteFont()', () => {
    it('должен отправить DELETE для удаления шрифта', async () => {
      client._fetchWithRetry.mockResolvedValue(null);

      await client.deleteFont('f-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/fonts/f-1', {
        method: 'DELETE',
      });
    });
  });

  describe('reorderFonts()', () => {
    it('должен отправить PATCH с массивом fontIds', async () => {
      const fontIds = ['f-3', 'f-1', 'f-2'];
      client._fetchWithRetry.mockResolvedValue(null);

      await client.reorderFonts(fontIds);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/fonts/reorder', {
        method: 'PATCH',
        body: { fontIds },
      });
    });
  });
});
