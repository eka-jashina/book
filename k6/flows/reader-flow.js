/**
 * Сценарий читателя — основной пользовательский путь.
 *
 * Вход → просмотр полки → открытие книги → чтение глав →
 * загрузка конфигурации → сохранение прогресса.
 *
 * Это наиболее частый сценарий реального трафика (~60%).
 */

import { sleep, group } from 'k6';
import { loginUser } from '../lib/auth.js';
import { generateProgress } from '../lib/data.js';
import { checkOk } from '../lib/checks.js';
import * as api from '../lib/endpoints.js';

/**
 * @param {{ email: string, password: string }} userData
 */
export function readerFlow(userData) {
  let csrf;

  group('Reader: 01. Авторизация', () => {
    const auth = loginUser(userData.email, userData.password);
    csrf = auth.csrfToken;
  });

  sleep(1);

  let books;
  group('Reader: 02. Просмотр полки', () => {
    const res = api.listBooks(csrf);
    checkOk(res, 'List books');
    try {
      books = res.json('data.books') || [];
    } catch {
      books = [];
    }
  });

  if (!books || books.length === 0) return;

  sleep(0.5);

  const bookId = books[0].id;

  group('Reader: 03. Открытие книги', () => {
    const res = api.getBook(csrf, bookId);
    checkOk(res, 'Get book detail');
  });

  sleep(0.3);

  let chapters;
  group('Reader: 04. Загрузка списка глав', () => {
    const res = api.listChapters(csrf, bookId);
    checkOk(res, 'List chapters');
    try {
      chapters = res.json('data.chapters') || [];
    } catch {
      chapters = [];
    }
  });

  if (chapters && chapters.length > 0) {
    group('Reader: 05. Чтение содержимого главы', () => {
      const res = api.getChapterContent(csrf, bookId, chapters[0].id);
      checkOk(res, 'Get chapter content');
    });

    sleep(2); // Имитация чтения

    group('Reader: 06. Загрузка конфигурации книги', () => {
      api.getAppearance(csrf, bookId);
      api.getSounds(csrf, bookId);
      api.listAmbients(csrf, bookId);
    });
  }

  sleep(1);

  group('Reader: 07. Сохранение прогресса', () => {
    const res = api.saveProgress(csrf, bookId, generateProgress(5));
    checkOk(res, 'Save progress');
  });

  group('Reader: 08. Чтение прогресса', () => {
    const res = api.getProgress(csrf, bookId);
    checkOk(res, 'Get progress');
  });

  sleep(0.5);
}
