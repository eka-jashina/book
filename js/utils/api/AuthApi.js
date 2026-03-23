/**
 * AUTH API — Аутентификация
 */

/** @type {Object<string, Function>} */
export const AuthApi = {
  /** Получить текущего пользователя (или null если не авторизован) */
  async getMe() {
    const data = await this._fetch('/api/v1/auth/me');
    return data.user;
  },

  /** Проверить доступность username (публичный, для регистрации) */
  async checkUsernamePublic(username) {
    return this._fetch(`/api/v1/auth/check-username/${encodeURIComponent(username)}`);
  },

  /** Регистрация + автоматический вход */
  async register(email, password, displayName, username) {
    const data = await this._fetch('/api/v1/auth/register', {
      method: 'POST',
      body: { email, password, displayName, username },
      suppressUnauthorized: true,
    });
    // Сессия регенерируется после регистрации — старый CSRF-токен невалиден
    this._csrfToken = null;
    return data.user;
  },

  /** Вход */
  async login(email, password) {
    const data = await this._fetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email, password },
      suppressUnauthorized: true,
    });
    // Сессия регенерируется после логина — старый CSRF-токен невалиден
    this._csrfToken = null;
    return data.user;
  },

  /** Выход */
  async logout() {
    await this._fetch('/api/v1/auth/logout', { method: 'POST' });
    this._csrfToken = null;
  },
};
