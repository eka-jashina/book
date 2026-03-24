/**
 * TESTS: SoundsApi
 * Тесты для миксина управления звуками
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('SoundsApi', () => {
  let client;
  const bookId = 'book-1';

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getSounds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSounds()', () => {
    it('должен запросить звуки книги', async () => {
      const sounds = { flip: '/sounds/flip.mp3', open: '/sounds/open.mp3' };
      client._fetchWithRetry.mockResolvedValue(sounds);

      const result = await client.getSounds(bookId);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/sounds`);
      expect(result).toEqual(sounds);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateSounds
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateSounds()', () => {
    it('должен отправить PATCH с данными звуков', async () => {
      const data = { flip: '/sounds/new-flip.mp3' };
      client._fetchWithRetry.mockResolvedValue({ ...data });

      await client.updateSounds(bookId, data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/sounds`, {
        method: 'PATCH',
        body: data,
      });
    });

    it('должен вернуть обновлённые звуки', async () => {
      const data = { flip: '/sounds/flip2.mp3' };
      client._fetchWithRetry.mockResolvedValue(data);

      const result = await client.updateSounds(bookId, data);

      expect(result).toEqual(data);
    });
  });
});
