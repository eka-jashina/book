/**
 * Сценарий автора — создание и настройка книги.
 *
 * Вход → создание книги → добавление глав → настройка внешнего вида →
 * добавление эмбиентов → обновление метаданных → удаление книги.
 *
 * Генерирует write-heavy нагрузку на базу данных.
 */

import { sleep, group } from 'k6';
import { loginUser } from '../lib/auth.js';
import {
  generateBook,
  generateChapter,
  generateAmbient,
  generateAppearanceUpdate,
} from '../lib/data.js';
import { checkOk, checkCreated } from '../lib/checks.js';
import * as api from '../lib/endpoints.js';

/**
 * @param {{ email: string, password: string }} userData
 */
export function authorFlow(userData) {
  let csrf;

  group('Author: 01. Авторизация', () => {
    const auth = loginUser(userData.email, userData.password);
    csrf = auth.csrfToken;
  });

  sleep(0.5);

  let bookId;
  group('Author: 02. Создание книги', () => {
    const res = api.createBook(csrf, generateBook(__VU));
    checkCreated(res, 'Create book');
    try {
      bookId = res.json('data.id');
    } catch {
      bookId = null;
    }
  });

  if (!bookId) return;

  sleep(0.3);

  group('Author: 03. Добавление глав', () => {
    for (let i = 1; i <= 3; i++) {
      const res = api.createChapter(csrf, bookId, generateChapter(i));
      checkCreated(res, `Create chapter ${i}`);
      sleep(0.2);
    }
  });

  sleep(0.5);

  group('Author: 04. Настройка внешнего вида', () => {
    const res = api.updateAppearance(csrf, bookId, generateAppearanceUpdate());
    checkOk(res, 'Update appearance');
  });

  sleep(0.3);

  group('Author: 05. Добавление эмбиента', () => {
    const res = api.createAmbient(csrf, bookId, generateAmbient(1));
    checkCreated(res, 'Create ambient');
  });

  sleep(0.3);

  group('Author: 06. Обновление метаданных', () => {
    const res = api.updateBook(csrf, bookId, {
      title: `Updated: K6 Book ${__VU} - ${Date.now()}`,
    });
    checkOk(res, 'Update book');
  });

  sleep(0.5);

  // Очистка: удаление книги после теста
  group('Author: 07. Удаление книги', () => {
    api.deleteBook(csrf, bookId);
  });
}
