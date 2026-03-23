/**
 * PROFILE API — Профиль пользователя
 */

/** @type {Object<string, Function>} */
export const ProfileApi = {
  /** Получить профиль текущего пользователя */
  async getProfile() {
    return this._fetchWithRetry('/api/v1/profile');
  },

  /** Обновить профиль текущего пользователя */
  async updateProfile(data) {
    return this._fetchWithRetry('/api/v1/profile', { method: 'PUT', body: data });
  },

  /** Проверить доступность username */
  async checkUsername(username) {
    return this._fetchWithRetry(`/api/v1/profile/check-username/${encodeURIComponent(username)}`);
  },
};
