/**
 * Нагрузочный тест: нормальная ожидаемая нагрузка.
 *
 * Стадии: 0→10→20→50→20→0 VU за 5 минут.
 * Цель: проверить производительность при типичном трафике.
 *
 * Распределение нагрузки (отражает реальный трафик):
 *   60% — читатели
 *   15% — авторы
 *   15% — анонимный просмотр
 *   10% — администрирование
 *
 * Запуск:
 *   k6 run k6/scenarios/load.js
 *   k6 run -e POOL_SIZE=100 k6/scenarios/load.js
 */

import { sleep } from 'k6';
import { registerUser, loginUser } from '../lib/auth.js';
import { generateUser, generateBook, generateChapter } from '../lib/data.js';
import { DEFAULT_THRESHOLDS, POOL_SIZE } from '../lib/config.js';
import { checkHealthy } from '../lib/checks.js';
import { readerFlow } from '../flows/reader-flow.js';
import { authorFlow } from '../flows/author-flow.js';
import { browsingFlow } from '../flows/browsing-flow.js';
import { adminFlow } from '../flows/admin-flow.js';
import * as api from '../lib/endpoints.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Разогрев
    { duration: '1m', target: 20 },   // Нарастание
    { duration: '2m', target: 50 },   // Пиковая нагрузка
    { duration: '1m', target: 20 },   // Снижение
    { duration: '30s', target: 0 },   // Остывание
  ],
  thresholds: DEFAULT_THRESHOLDS,
  tags: { test_type: 'load' },
};

/**
 * Подготовка: создание пула тестовых пользователей с данными.
 */
export function setup() {
  const healthRes = api.healthCheck();
  checkHealthy(healthRes);

  const users = [];
  const poolSize = Math.min(POOL_SIZE, 50);

  for (let i = 0; i < poolSize; i++) {
    const userData = generateUser(i, 0);
    registerUser(userData.email, userData.password, userData.displayName, userData.username);

    // Логинимся и создаём книгу с главой
    const auth = loginUser(userData.email, userData.password);
    const bookRes = api.createBook(auth.csrfToken, generateBook(i));
    if (bookRes.status === 201) {
      try {
        const bookId = bookRes.json('data.id');
        api.createChapter(auth.csrfToken, bookId, generateChapter(1));
        // Публикуем несколько книг для browsingFlow
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

  // Распределение по сценариям
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
