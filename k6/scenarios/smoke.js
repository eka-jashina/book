/**
 * Дымовой тест: минимальная нагрузка, проверка работоспособности всех эндпоинтов.
 *
 * VU: 2 | Длительность: 30с
 * Цель: убедиться, что все API-эндпоинты отвечают корректно.
 *
 * Запуск:
 *   k6 run k6/scenarios/smoke.js
 *   k6 run -e BASE_URL=http://localhost:4000 k6/scenarios/smoke.js
 */

import { sleep } from 'k6';
import { registerUser, loginUser } from '../lib/auth.js';
import { generateUser, generateBook, generateChapter } from '../lib/data.js';
import { SMOKE_THRESHOLDS } from '../lib/config.js';
import { checkHealthy } from '../lib/checks.js';
import { readerFlow } from '../flows/reader-flow.js';
import { authorFlow } from '../flows/author-flow.js';
import { browsingFlow } from '../flows/browsing-flow.js';
import { adminFlow } from '../flows/admin-flow.js';
import * as api from '../lib/endpoints.js';

export const options = {
  vus: 2,
  duration: '30s',
  thresholds: SMOKE_THRESHOLDS,
  tags: { test_type: 'smoke' },
};

/**
 * Подготовка: проверка здоровья сервера + регистрация тестовых пользователей.
 * Создаём книгу с главой для каждого пользователя (нужно для readerFlow).
 */
export function setup() {
  // Проверяем здоровье сервера
  const healthRes = api.healthCheck();
  checkHealthy(healthRes);

  const users = [];

  for (let i = 0; i < 2; i++) {
    const userData = generateUser(i, 0);
    registerUser(userData.email, userData.password, userData.displayName, userData.username);

    // Логинимся и создаём книгу с главой для readerFlow
    const auth = loginUser(userData.email, userData.password);
    const bookRes = api.createBook(auth.csrfToken, generateBook(i));
    if (bookRes.status === 201) {
      try {
        const bookId = bookRes.json('data.id');
        api.createChapter(auth.csrfToken, bookId, generateChapter(1));
        // Публикуем книгу для browsingFlow
        api.updateBook(auth.csrfToken, bookId, { visibility: 'published' });
      } catch {
        // Книга создана, но глава/публикация не удались — продолжаем
      }
    }

    users.push({ email: userData.email, password: userData.password });
  }

  return { users };
}

export default function (data) {
  const user = data.users[__VU % data.users.length];

  // Чередуем разные сценарии по итерациям
  const scenario = __ITER % 4;
  if (scenario === 0) {
    browsingFlow();
  } else if (scenario === 1) {
    readerFlow(user);
  } else if (scenario === 2) {
    authorFlow(user);
  } else {
    adminFlow(user);
  }

  sleep(1);
}
