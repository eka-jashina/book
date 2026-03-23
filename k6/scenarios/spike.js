/**
 * Спайк-тест: резкий всплеск трафика.
 *
 * Стадии: 10→200 (мгновенный скачок)→200→10→10→0.
 * Цель: проверить устойчивость при резком всплеске нагрузки.
 *
 * Запуск:
 *   k6 run k6/scenarios/spike.js
 */

import { sleep } from 'k6';
import { registerUser, loginUser } from '../lib/auth.js';
import { generateUser, generateBook, generateChapter } from '../lib/data.js';
import { SPIKE_THRESHOLDS, POOL_SIZE } from '../lib/config.js';
import { checkHealthy } from '../lib/checks.js';
import { readerFlow } from '../flows/reader-flow.js';
import { authorFlow } from '../flows/author-flow.js';
import { browsingFlow } from '../flows/browsing-flow.js';
import * as api from '../lib/endpoints.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Фоновая нагрузка
    { duration: '10s', target: 200 },  // Резкий всплеск!
    { duration: '1m', target: 200 },   // Удержание пика
    { duration: '10s', target: 10 },   // Резкое снижение
    { duration: '2m', target: 10 },    // Восстановление
    { duration: '30s', target: 0 },    // Остывание
  ],
  thresholds: SPIKE_THRESHOLDS,
  tags: { test_type: 'spike' },
};

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
        if (i < 5) {
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

  // При спайке увеличиваем долю лёгких запросов (browsing)
  const rand = Math.random();
  if (rand < 0.40) {
    readerFlow(user);
  } else if (rand < 0.55) {
    authorFlow(user);
  } else {
    browsingFlow();
  }

  sleep(0.5);
}
