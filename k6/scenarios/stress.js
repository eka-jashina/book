/**
 * Стресс-тест: поиск предела производительности.
 *
 * Стадии: 0→50→100→200→100→50→0 VU за 10 минут.
 * Цель: найти точку отказа (VU при котором ошибки превышают 15%).
 *
 * Запуск:
 *   k6 run k6/scenarios/stress.js
 *   k6 run -e POOL_SIZE=200 k6/scenarios/stress.js
 */

import { sleep } from 'k6';
import { registerUser, loginUser } from '../lib/auth.js';
import { generateUser, generateBook, generateChapter } from '../lib/data.js';
import { STRESS_THRESHOLDS, POOL_SIZE } from '../lib/config.js';
import { checkHealthy } from '../lib/checks.js';
import { readerFlow } from '../flows/reader-flow.js';
import { authorFlow } from '../flows/author-flow.js';
import { browsingFlow } from '../flows/browsing-flow.js';
import { adminFlow } from '../flows/admin-flow.js';
import * as api from '../lib/endpoints.js';

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Нарастание
    { duration: '2m', target: 100 },   // Серьёзная нагрузка
    { duration: '3m', target: 200 },   // Пиковая стресс-нагрузка
    { duration: '2m', target: 100 },   // Снижение
    { duration: '1m', target: 50 },    // Дальнейшее снижение
    { duration: '1m', target: 0 },     // Остывание
  ],
  thresholds: STRESS_THRESHOLDS,
  tags: { test_type: 'stress' },
};

/**
 * Подготовка: увеличенный пул пользователей для стресс-теста.
 */
export function setup() {
  const healthRes = api.healthCheck();
  checkHealthy(healthRes);

  const users = [];
  const poolSize = Math.min(POOL_SIZE, 200);

  for (let i = 0; i < poolSize; i++) {
    const userData = generateUser(i, 0);
    registerUser(userData.email, userData.password, userData.displayName, userData.username);

    const auth = loginUser(userData.email, userData.password);
    const bookRes = api.createBook(auth.csrfToken, generateBook(i));
    if (bookRes.status === 201) {
      try {
        const bookId = bookRes.json('data.id');
        api.createChapter(auth.csrfToken, bookId, generateChapter(1));
        if (i < 10) {
          api.updateBook(auth.csrfToken, bookId, { visibility: 'published' });
        }
      } catch {
        // Продолжаем
      }
    }

    users.push({ email: userData.email, password: userData.password });
  }

  return { users };
}

export default function (data) {
  const user = data.users[__VU % data.users.length];

  const rand = Math.random();
  if (rand < 0.60) {
    readerFlow(user);
  } else if (rand < 0.75) {
    authorFlow(user);
  } else if (rand < 0.90) {
    browsingFlow();
  } else {
    adminFlow(user);
  }

  sleep(1);
}
