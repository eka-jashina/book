/**
 * TESTS: BooksApi
 * Тесты для миксина управления книгами
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('BooksApi', () => {
  let client;

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getBooks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBooks()', () => {
    it('должен вызвать _fetchWithRetry с правильным путём', async () => {
      client._fetchWithRetry.mockResolvedValue([]);

      await client.getBooks();

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books');
    });

    it('должен вернуть список книг', async () => {
      const books = [{ id: '1', title: 'Book 1' }, { id: '2', title: 'Book 2' }];
      client._fetchWithRetry.mockResolvedValue(books);

      const result = await client.getBooks();

      expect(result).toEqual(books);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createBook
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createBook()', () => {
    it('должен отправить POST с данными книги', async () => {
      const data = { title: 'New Book', description: 'Description' };
      client._fetchWithRetry.mockResolvedValue({ id: '1', ...data });

      await client.createBook(data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books', {
        method: 'POST',
        body: data,
      });
    });

    it('должен вернуть созданную книгу', async () => {
      const book = { id: '1', title: 'New Book' };
      client._fetchWithRetry.mockResolvedValue(book);

      const result = await client.createBook({ title: 'New Book' });

      expect(result).toEqual(book);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getBook
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getBook()', () => {
    it('должен запросить книгу по ID', async () => {
      client._fetchWithRetry.mockResolvedValue({ id: 'abc' });

      await client.getBook('abc');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/abc');
    });

    it('должен вернуть данные книги', async () => {
      const book = { id: 'abc', title: 'Test', chapters: [] };
      client._fetchWithRetry.mockResolvedValue(book);

      const result = await client.getBook('abc');

      expect(result).toEqual(book);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateBook
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateBook()', () => {
    it('должен отправить PATCH с данными обновления', async () => {
      const data = { title: 'Updated' };
      client._fetchWithRetry.mockResolvedValue({ id: '1', ...data });

      await client.updateBook('1', data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/1', {
        method: 'PATCH',
        body: data,
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deleteBook
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deleteBook()', () => {
    it('должен отправить DELETE', async () => {
      client._fetchWithRetry.mockResolvedValue(null);

      await client.deleteBook('1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/1', {
        method: 'DELETE',
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // reorderBooks
  // ═══════════════════════════════════════════════════════════════════════════

  describe('reorderBooks()', () => {
    it('должен отправить PATCH с массивом bookIds', async () => {
      const bookIds = ['3', '1', '2'];
      client._fetchWithRetry.mockResolvedValue(null);

      await client.reorderBooks(bookIds);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/reorder', {
        method: 'PATCH',
        body: { bookIds },
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // checkBookSlug
  // ═══════════════════════════════════════════════════════════════════════════

  describe('checkBookSlug()', () => {
    it('должен проверить slug без excludeBookId', async () => {
      client._fetchWithRetry.mockResolvedValue({ available: true });

      await client.checkBookSlug('my-book');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/check-slug/my-book');
    });

    it('должен добавить excludeBookId как query param', async () => {
      client._fetchWithRetry.mockResolvedValue({ available: true });

      await client.checkBookSlug('my-book', 'book-123');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/books/check-slug/my-book?excludeBookId=book-123'
      );
    });

    it('должен закодировать slug с спецсимволами', async () => {
      client._fetchWithRetry.mockResolvedValue({ available: false });

      await client.checkBookSlug('my book');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/books/check-slug/my%20book');
    });

    it('должен вернуть результат проверки', async () => {
      const data = { available: true, suggestion: null };
      client._fetchWithRetry.mockResolvedValue(data);

      const result = await client.checkBookSlug('test');

      expect(result).toEqual(data);
    });
  });
});
