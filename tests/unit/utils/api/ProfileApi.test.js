/**
 * TESTS: ProfileApi
 * Тесты для миксина управления профилем пользователя
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('ProfileApi', () => {
  let client;

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getProfile
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getProfile()', () => {
    it('должен запросить профиль текущего пользователя', async () => {
      const profile = { id: '1', displayName: 'Test', username: 'testuser' };
      client._fetchWithRetry.mockResolvedValue(profile);

      const result = await client.getProfile();

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/profile');
      expect(result).toEqual(profile);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateProfile
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateProfile()', () => {
    it('должен отправить PUT с данными профиля', async () => {
      const data = { displayName: 'New Name', bio: 'About me' };
      client._fetchWithRetry.mockResolvedValue({ id: '1', ...data });

      await client.updateProfile(data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/profile', {
        method: 'PUT',
        body: data,
      });
    });

    it('должен вернуть обновлённый профиль', async () => {
      const profile = { id: '1', displayName: 'Updated' };
      client._fetchWithRetry.mockResolvedValue(profile);

      const result = await client.updateProfile({ displayName: 'Updated' });

      expect(result).toEqual(profile);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkUsername
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkUsername()', () => {
    it('должен проверить доступность username', async () => {
      client._fetchWithRetry.mockResolvedValue({ available: true });

      await client.checkUsername('newuser');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/profile/check-username/newuser',
      );
    });

    it('должен закодировать спецсимволы в username', async () => {
      client._fetchWithRetry.mockResolvedValue({ available: false });

      await client.checkUsername('user name');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/profile/check-username/user%20name',
      );
    });

    it('должен вернуть результат проверки', async () => {
      const data = { available: true };
      client._fetchWithRetry.mockResolvedValue(data);

      const result = await client.checkUsername('test');

      expect(result).toEqual(data);
    });
  });
});
