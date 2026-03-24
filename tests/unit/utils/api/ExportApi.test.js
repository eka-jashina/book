/**
 * TESTS: ExportApi
 * Тесты для миксина экспорта/импорта конфигурации и health-check
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('ExportApi', () => {
  let client;

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // exportConfig
  // ═══════════════════════════════════════════════════════════════════════════

  describe('exportConfig()', () => {
    it('должен запросить экспорт через _fetchWithRetry', async () => {
      const config = { books: [], fonts: [] };
      client._fetchWithRetry.mockResolvedValue(config);

      const result = await client.exportConfig();

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/export');
      expect(result).toEqual(config);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // importConfig
  // ═══════════════════════════════════════════════════════════════════════════

  describe('importConfig()', () => {
    it('должен отправить POST с данными конфигурации', async () => {
      const data = { books: [{ title: 'Book' }], fonts: [] };
      client._fetchWithRetry.mockResolvedValue({ imported: true });

      await client.importConfig(data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/import', {
        method: 'POST',
        body: data,
      });
    });

    it('должен вернуть результат импорта', async () => {
      const result = { imported: true, booksCount: 3 };
      client._fetchWithRetry.mockResolvedValue(result);

      const response = await client.importConfig({ books: [] });

      expect(response).toEqual(result);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // health
  // ═══════════════════════════════════════════════════════════════════════════

  describe('health()', () => {
    it('должен использовать _fetch (не _fetchWithRetry)', async () => {
      client._fetch.mockResolvedValue({ status: 'ok' });

      await client.health();

      expect(client._fetch).toHaveBeenCalledWith('/api/health');
      expect(client._fetchWithRetry).not.toHaveBeenCalled();
    });

    it('должен вернуть статус здоровья', async () => {
      const health = { status: 'ok', uptime: 12345 };
      client._fetch.mockResolvedValue(health);

      const result = await client.health();

      expect(result).toEqual(health);
    });
  });
});
