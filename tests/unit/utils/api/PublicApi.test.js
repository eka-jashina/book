/**
 * TESTS: PublicApi
 * Тесты для миксина публичного API
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('PublicApi', () => {
  let client;

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPublicShelf
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getPublicShelf()', () => {
    it('должен запросить полку по username', async () => {
      client._fetchWithRetry.mockResolvedValue({ books: [] });

      await client.getPublicShelf('johndoe');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/public/shelves/johndoe');
    });

    it('должен кодировать username со спецсимволами', async () => {
      client._fetchWithRetry.mockResolvedValue({ books: [] });

      await client.getPublicShelf('user name');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/public/shelves/user%20name');
    });

    it('должен вернуть данные полки', async () => {
      const data = { books: [{ id: '1' }], author: 'John' };
      client._fetchWithRetry.mockResolvedValue(data);

      const result = await client.getPublicShelf('johndoe');

      expect(result).toEqual(data);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPublicDiscover
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getPublicDiscover()', () => {
    it('должен запросить витрину с дефолтным limit=6', async () => {
      client._fetchWithRetry.mockResolvedValue([]);

      await client.getPublicDiscover();

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/public/discover?limit=6');
    });

    it('должен передать пользовательский limit', async () => {
      client._fetchWithRetry.mockResolvedValue([]);

      await client.getPublicDiscover(12);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/public/discover?limit=12');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPublicBook
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getPublicBook()', () => {
    it('должен запросить книгу по ID', async () => {
      client._fetchWithRetry.mockResolvedValue({ id: 'abc' });

      await client.getPublicBook('abc');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/public/books/abc');
    });

    it('должен кодировать ID со спецсимволами', async () => {
      client._fetchWithRetry.mockResolvedValue({});

      await client.getPublicBook('book/test');

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/public/books/book%2Ftest');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPublicBookBySlug
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getPublicBookBySlug()', () => {
    it('должен запросить книгу по username и slug', async () => {
      client._fetchWithRetry.mockResolvedValue({ id: '1' });

      await client.getPublicBookBySlug('johndoe', 'my-book');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/public/shelves/johndoe/my-book'
      );
    });

    it('должен кодировать спецсимволы в username и slug', async () => {
      client._fetchWithRetry.mockResolvedValue({});

      await client.getPublicBookBySlug('user name', 'book slug');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/public/shelves/user%20name/book%20slug'
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getPublicChapterContent
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getPublicChapterContent()', () => {
    it('должен запросить контент главы', async () => {
      client._fetchWithRetry.mockResolvedValue({ html: '<p>Text</p>' });

      await client.getPublicChapterContent('book-1', 'ch-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/public/books/book-1/chapters/ch-1/content'
      );
    });

    it('должен кодировать спецсимволы в ID', async () => {
      client._fetchWithRetry.mockResolvedValue({});

      await client.getPublicChapterContent('a/b', 'c/d');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        '/api/v1/public/books/a%2Fb/chapters/c%2Fd/content'
      );
    });

    it('должен вернуть контент', async () => {
      const content = { html: '<p>Content</p>' };
      client._fetchWithRetry.mockResolvedValue(content);

      const result = await client.getPublicChapterContent('book-1', 'ch-1');

      expect(result).toEqual(content);
    });
  });
});
