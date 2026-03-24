/**
 * TESTS: SettingsApi
 * Тесты для миксина настроек
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('SettingsApi', () => {
  let client;

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getSettings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getSettings()', () => {
    it('должен запросить глобальные настройки', async () => {
      client._fetchWithRetry.mockResolvedValue({ fontMin: 14, fontMax: 22 });

      await client.getSettings();

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/settings');
    });

    it('должен вернуть настройки', async () => {
      const settings = { fontMin: 14, fontMax: 22 };
      client._fetchWithRetry.mockResolvedValue(settings);

      const result = await client.getSettings();

      expect(result).toEqual(settings);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateSettings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateSettings()', () => {
    it('должен отправить PATCH с обновлёнными настройками', async () => {
      const data = { fontMin: 12 };
      client._fetchWithRetry.mockResolvedValue(data);

      await client.updateSettings(data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/settings', {
        method: 'PATCH',
        body: data,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getDefaultSettings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getDefaultSettings()', () => {
    it('должен запросить дефолтные настройки книги', async () => {
      client._fetchWithRetry.mockResolvedValue({ font: 'serif', fontSize: 16 });

      await client.getDefaultSettings('book-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/book-1/default-settings');
    });

    it('должен вернуть дефолтные настройки', async () => {
      const settings = { font: 'serif', fontSize: 16, theme: 'light' };
      client._fetchWithRetry.mockResolvedValue(settings);

      const result = await client.getDefaultSettings('book-1');

      expect(result).toEqual(settings);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateDefaultSettings
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateDefaultSettings()', () => {
    it('должен отправить PATCH с настройками книги', async () => {
      const data = { font: 'mono', fontSize: 18 };
      client._fetchWithRetry.mockResolvedValue(data);

      await client.updateDefaultSettings('book-1', data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/book-1/default-settings', {
        method: 'PATCH',
        body: data,
      });
    });
  });
});
