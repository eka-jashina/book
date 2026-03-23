/**
 * Сценарий анонимного просмотра — публичные эндпоинты.
 *
 * Health check → обзор книг (discover) → просмотр публичной книги.
 * Аутентификация не требуется.
 */

import { sleep, group } from 'k6';
import { check } from 'k6';
import * as api from '../lib/endpoints.js';

export function browsingFlow() {
  group('Browse: 01. Health check', () => {
    const res = api.healthCheck();
    check(res, { 'Health OK': (r) => r.status === 200 });
  });

  sleep(0.5);

  let books = [];
  group('Browse: 02. Обзор книг (discover)', () => {
    const res = api.discoverBooks(10, 0);
    check(res, { 'Discover — 200': (r) => r.status === 200 });
    try {
      books = res.json('data.books') || [];
    } catch {
      books = [];
    }
  });

  sleep(1);

  if (books.length > 0) {
    const bookId = books[0].id;

    group('Browse: 03. Просмотр публичной книги', () => {
      const res = api.getPublicBook(bookId);
      check(res, {
        'Public book — 200 or 404': (r) => r.status === 200 || r.status === 404,
      });
    });
  }

  sleep(0.5);
}
