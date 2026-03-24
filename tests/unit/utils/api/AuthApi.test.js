/**
 * TESTS: AuthApi
 * Тесты для миксина аутентификации
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('AuthApi', () => {
  let client;

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getMe
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getMe()', () => {
    it('должен вызвать _fetch с правильным путём', async () => {
      client._fetch.mockResolvedValue({ user: { id: '1', email: 'test@test.com' } });

      await client.getMe();

      expect(client._fetch).toHaveBeenCalledWith('/api/v1/auth/me');
    });

    it('должен вернуть user из ответа', async () => {
      const user = { id: '1', email: 'test@test.com', displayName: 'Test' };
      client._fetch.mockResolvedValue({ user });

      const result = await client.getMe();

      expect(result).toEqual(user);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkUsernamePublic
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkUsernamePublic()', () => {
    it('должен вызвать _fetch с закодированным username', async () => {
      client._fetch.mockResolvedValue({ available: true });

      await client.checkUsernamePublic('test user');

      expect(client._fetch).toHaveBeenCalledWith('/api/v1/auth/check-username/test%20user');
    });

    it('должен вернуть результат проверки', async () => {
      const data = { available: true };
      client._fetch.mockResolvedValue(data);

      const result = await client.checkUsernamePublic('testuser');

      expect(result).toEqual(data);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // register
  // ═══════════════════════════════════════════════════════════════════════════

  describe('register()', () => {
    it('должен отправить POST с данными регистрации', async () => {
      client._fetch.mockResolvedValue({ user: { id: '1' } });

      await client.register('test@test.com', 'pass123', 'Test User', 'testuser');

      expect(client._fetch).toHaveBeenCalledWith('/api/v1/auth/register', {
        method: 'POST',
        body: { email: 'test@test.com', password: 'pass123', displayName: 'Test User', username: 'testuser' },
        suppressUnauthorized: true,
      });
    });

    it('должен сбросить csrfToken после регистрации', async () => {
      client._fetch.mockResolvedValue({ user: { id: '1' } });

      await client.register('a@b.com', 'pass', 'Name', 'user');

      expect(client._csrfToken).toBeNull();
    });

    it('должен вернуть user из ответа', async () => {
      const user = { id: '1', email: 'a@b.com' };
      client._fetch.mockResolvedValue({ user });

      const result = await client.register('a@b.com', 'pass', 'Name', 'user');

      expect(result).toEqual(user);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // login
  // ═══════════════════════════════════════════════════════════════════════════

  describe('login()', () => {
    it('должен отправить POST с учётными данными', async () => {
      client._fetch.mockResolvedValue({ user: { id: '1' } });

      await client.login('test@test.com', 'password');

      expect(client._fetch).toHaveBeenCalledWith('/api/v1/auth/login', {
        method: 'POST',
        body: { email: 'test@test.com', password: 'password' },
        suppressUnauthorized: true,
      });
    });

    it('должен сбросить csrfToken после логина', async () => {
      client._fetch.mockResolvedValue({ user: { id: '1' } });

      await client.login('a@b.com', 'pass');

      expect(client._csrfToken).toBeNull();
    });

    it('должен вернуть user из ответа', async () => {
      const user = { id: '1', email: 'a@b.com' };
      client._fetch.mockResolvedValue({ user });

      const result = await client.login('a@b.com', 'pass');

      expect(result).toEqual(user);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // logout
  // ═══════════════════════════════════════════════════════════════════════════

  describe('logout()', () => {
    it('должен отправить POST на /api/v1/auth/logout', async () => {
      client._fetch.mockResolvedValue(undefined);

      await client.logout();

      expect(client._fetch).toHaveBeenCalledWith('/api/v1/auth/logout', { method: 'POST' });
    });

    it('должен сбросить csrfToken после логаута', async () => {
      client._fetch.mockResolvedValue(undefined);

      await client.logout();

      expect(client._csrfToken).toBeNull();
    });
  });
});
