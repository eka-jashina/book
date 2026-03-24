/**
 * TESTS: ProgressApi
 * Тесты для миксина прогресса чтения
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('ProgressApi', () => {
  let client;

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getProgress
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getProgress()', () => {
    it('должен запросить прогресс по bookId', async () => {
      client._fetchWithRetry.mockResolvedValue({ progress: { page: 5 } });

      await client.getProgress('book-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/book-1/progress');
    });

    it('должен извлечь вложенный объект progress', async () => {
      client._fetchWithRetry.mockResolvedValue({ progress: { page: 5, font: 'serif' } });

      const result = await client.getProgress('book-1');

      expect(result).toEqual({ page: 5, font: 'serif' });
    });

    it('должен вернуть результат напрямую, если нет вложенного progress', async () => {
      const data = { page: 3 };
      client._fetchWithRetry.mockResolvedValue(data);

      const result = await client.getProgress('book-1');

      expect(result).toEqual(data);
    });

    it('должен вернуть null при 404', async () => {
      client._fetchWithRetry.mockRejectedValue({ status: 404 });

      const result = await client.getProgress('missing');

      expect(result).toBeNull();
    });

    it('должен пробросить другие ошибки', async () => {
      const error = { status: 500 };
      client._fetchWithRetry.mockRejectedValue(error);

      await expect(client.getProgress('book-1')).rejects.toEqual(error);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // saveProgress
  // ═══════════════════════════════════════════════════════════════════════════

  describe('saveProgress()', () => {
    it('должен отправить PUT с данными прогресса', async () => {
      const data = { page: 10, font: 'mono' };
      client._fetchWithRetry.mockResolvedValue(data);

      await client.saveProgress('book-1', data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/book-1/progress', {
        method: 'PUT',
        body: data,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // saveReadingSession
  // ═══════════════════════════════════════════════════════════════════════════

  describe('saveReadingSession()', () => {
    it('должен отправить POST с данными сессии', async () => {
      const data = { startPage: 1, endPage: 5, duration: 300 };
      client._fetchWithRetry.mockResolvedValue({ id: 's1' });

      await client.saveReadingSession('book-1', data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/book-1/reading-sessions', {
        method: 'POST',
        body: data,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getReadingSessions
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getReadingSessions()', () => {
    it('должен запросить сессии с дефолтными параметрами', async () => {
      client._fetchWithRetry.mockResolvedValue([]);

      await client.getReadingSessions('book-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/books/book-1/reading-sessions?limit=50&offset=0'
      );
    });

    it('должен передать пользовательские limit и offset', async () => {
      client._fetchWithRetry.mockResolvedValue([]);

      await client.getReadingSessions('book-1', { limit: 10, offset: 20 });

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/books/book-1/reading-sessions?limit=10&offset=20'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getReadingStats
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getReadingStats()', () => {
    it('должен запросить статистику по bookId', async () => {
      const stats = { totalDuration: 1200, sessionsCount: 5 };
      client._fetchWithRetry.mockResolvedValue(stats);

      const result = await client.getReadingStats('book-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/books/book-1/reading-sessions/stats'
      );
      expect(result).toEqual(stats);
    });
  });
});
