/**
 * Хелперы аутентификации для k6.
 *
 * Реализует полный цикл CSRF + сессия:
 * 1. GET /api/v1/auth/csrf-token — получает токен и cookie __csrf
 * 2. POST /api/v1/auth/register (или /login) — с заголовком x-csrf-token
 * 3. После register/login сессия пересоздаётся (session.regenerate),
 *    поэтому нужно заново получить CSRF-токен
 */

import http from 'k6/http';
import { check } from 'k6';
import { API_V1 } from './config.js';

/**
 * Получить CSRF-токен (устанавливает cookie __csrf).
 * @returns {string} CSRF-токен
 */
export function getCsrfToken() {
  const res = http.get(`${API_V1}/auth/csrf-token`);
  check(res, { 'CSRF token obtained': (r) => r.status === 200 });
  return res.json('data.token');
}

/**
 * Зарегистрировать нового пользователя.
 * После регистрации сессия пересоздаётся — нужен новый CSRF-токен.
 * @returns {{ csrfToken: string, user: object }}
 */
export function registerUser(email, password, displayName, username) {
  // Получаем начальный CSRF-токен
  const initialCsrf = getCsrfToken();

  const res = http.post(
    `${API_V1}/auth/register`,
    JSON.stringify({ email, password, displayName, username }),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': initialCsrf,
      },
    },
  );
  check(res, { 'User registered': (r) => r.status === 201 });

  // После session.regenerate() нужен свежий CSRF-токен
  const freshCsrf = getCsrfToken();

  return { csrfToken: freshCsrf, user: res.json('data.user') };
}

/**
 * Войти существующим пользователем.
 * После логина сессия пересоздаётся — нужен новый CSRF-токен.
 * @returns {{ csrfToken: string, user: object }}
 */
export function loginUser(email, password) {
  const initialCsrf = getCsrfToken();

  const res = http.post(
    `${API_V1}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': initialCsrf,
      },
    },
  );
  check(res, { 'User logged in': (r) => r.status === 200 });

  // Свежий CSRF после session.regenerate()
  const freshCsrf = getCsrfToken();

  return { csrfToken: freshCsrf, user: res.json('data.user') };
}

/**
 * Хелпер для создания заголовков с CSRF и Content-Type.
 * @param {string} csrfToken
 * @returns {object} заголовки
 */
export function authHeaders(csrfToken) {
  return {
    'Content-Type': 'application/json',
    'x-csrf-token': csrfToken,
  };
}
