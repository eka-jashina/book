/**
 * TESTS: AppearanceApi
 * Тесты для миксина управления внешним видом
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('AppearanceApi', () => {
  let client;
  const bookId = 'book-1';

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getAppearance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getAppearance()', () => {
    it('должен запросить настройки внешнего вида', async () => {
      const appearance = { fontMin: 14, fontMax: 22, light: {}, dark: {} };
      client._fetchWithRetry.mockResolvedValue(appearance);

      const result = await client.getAppearance(bookId);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/appearance`);
      expect(result).toEqual(appearance);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateAppearance
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateAppearance()', () => {
    it('должен отправить PATCH с общими настройками', async () => {
      const data = { fontMin: 12, fontMax: 24 };
      client._fetchWithRetry.mockResolvedValue(data);

      await client.updateAppearance(bookId, data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/appearance`, {
        method: 'PATCH',
        body: data,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateAppearanceTheme
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateAppearanceTheme()', () => {
    it('должен отправить PATCH для light-темы', async () => {
      const data = { bgColor: '#ffffff', textColor: '#000000' };
      client._fetchWithRetry.mockResolvedValue(data);

      await client.updateAppearanceTheme(bookId, 'light', data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/appearance/light`,
        { method: 'PATCH', body: data },
      );
    });

    it('должен отправить PATCH для dark-темы', async () => {
      const data = { bgColor: '#1a1a1a', textColor: '#e0e0e0' };
      client._fetchWithRetry.mockResolvedValue(data);

      await client.updateAppearanceTheme(bookId, 'dark', data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/appearance/dark`,
        { method: 'PATCH', body: data },
      );
    });

    it('должен вернуть обновлённую тему', async () => {
      const themeData = { bgColor: '#fff' };
      client._fetchWithRetry.mockResolvedValue(themeData);

      const result = await client.updateAppearanceTheme(bookId, 'light', themeData);

      expect(result).toEqual(themeData);
    });
  });
});
