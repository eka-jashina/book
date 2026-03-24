/**
 * TESTS: AmbientsApi
 * Тесты для миксина управления эмбиентами
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('AmbientsApi', () => {
  let client;
  const bookId = 'book-1';

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getAmbients
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getAmbients()', () => {
    it('должен запросить список эмбиентов книги', async () => {
      const ambients = [{ id: 'a-1', name: 'Rain' }];
      client._fetchWithRetry.mockResolvedValue(ambients);

      const result = await client.getAmbients(bookId);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/ambients`);
      expect(result).toEqual(ambients);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createAmbient
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createAmbient()', () => {
    it('должен отправить POST с данными эмбиента', async () => {
      const data = { name: 'Forest', url: '/sounds/forest.mp3' };
      client._fetchWithRetry.mockResolvedValue({ id: 'a-1', ...data });

      await client.createAmbient(bookId, data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/ambients`, {
        method: 'POST',
        body: data,
      });
    });

    it('должен вернуть созданный эмбиент', async () => {
      const ambient = { id: 'a-1', name: 'Forest' };
      client._fetchWithRetry.mockResolvedValue(ambient);

      const result = await client.createAmbient(bookId, { name: 'Forest' });

      expect(result).toEqual(ambient);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateAmbient
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateAmbient()', () => {
    it('должен отправить PATCH с данными обновления', async () => {
      const data = { name: 'Updated Rain' };
      client._fetchWithRetry.mockResolvedValue({ id: 'a-1', ...data });

      await client.updateAmbient(bookId, 'a-1', data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/ambients/a-1`,
        { method: 'PATCH', body: data },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deleteAmbient
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deleteAmbient()', () => {
    it('должен отправить DELETE для эмбиента', async () => {
      client._fetchWithRetry.mockResolvedValue(null);

      await client.deleteAmbient(bookId, 'a-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/ambients/a-1`,
        { method: 'DELETE' },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // reorderAmbients
  // ═══════════════════════════════════════════════════════════════════════════

  describe('reorderAmbients()', () => {
    it('должен отправить PATCH с массивом ambientIds', async () => {
      const ambientIds = ['a-3', 'a-1', 'a-2'];
      client._fetchWithRetry.mockResolvedValue(null);

      await client.reorderAmbients(bookId, ambientIds);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/ambients/reorder`,
        { method: 'PATCH', body: { ambientIds } },
      );
    });
  });
});
