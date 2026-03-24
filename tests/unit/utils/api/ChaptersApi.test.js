/**
 * TESTS: ChaptersApi
 * Тесты для миксина управления главами
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('ChaptersApi', () => {
  let client;
  const bookId = 'book-1';

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getChapters
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getChapters()', () => {
    it('должен запросить список глав по bookId', async () => {
      client._fetchWithRetry.mockResolvedValue([]);

      await client.getChapters(bookId);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/chapters`);
    });

    it('должен вернуть список глав', async () => {
      const chapters = [{ id: 'ch-1', title: 'Chapter 1' }];
      client._fetchWithRetry.mockResolvedValue(chapters);

      const result = await client.getChapters(bookId);

      expect(result).toEqual(chapters);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // createChapter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('createChapter()', () => {
    it('должен отправить POST с данными главы', async () => {
      const data = { title: 'New Chapter', content: '<p>Text</p>' };
      client._fetchWithRetry.mockResolvedValue({ id: 'ch-1', ...data });

      await client.createChapter(bookId, data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/chapters`, {
        method: 'POST',
        body: data,
      });
    });

    it('должен вернуть созданную главу', async () => {
      const chapter = { id: 'ch-1', title: 'New' };
      client._fetchWithRetry.mockResolvedValue(chapter);

      const result = await client.createChapter(bookId, { title: 'New' });

      expect(result).toEqual(chapter);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getChapter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getChapter()', () => {
    it('должен запросить главу по bookId и chapterId', async () => {
      client._fetchWithRetry.mockResolvedValue({ id: 'ch-1' });

      await client.getChapter(bookId, 'ch-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(`/api/v1/books/${bookId}/chapters/ch-1`);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // updateChapter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('updateChapter()', () => {
    it('должен отправить PATCH с данными обновления', async () => {
      const data = { title: 'Updated Chapter' };
      client._fetchWithRetry.mockResolvedValue({ id: 'ch-1', ...data });

      await client.updateChapter(bookId, 'ch-1', data);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/chapters/ch-1`,
        { method: 'PATCH', body: data },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // deleteChapter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('deleteChapter()', () => {
    it('должен отправить DELETE для главы', async () => {
      client._fetchWithRetry.mockResolvedValue(null);

      await client.deleteChapter(bookId, 'ch-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/chapters/ch-1`,
        { method: 'DELETE' },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // reorderChapters
  // ═══════════════════════════════════════════════════════════════════════════

  describe('reorderChapters()', () => {
    it('должен отправить PATCH с массивом chapterIds', async () => {
      const chapterIds = ['ch-3', 'ch-1', 'ch-2'];
      client._fetchWithRetry.mockResolvedValue(null);

      await client.reorderChapters(bookId, chapterIds);

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/chapters/reorder`,
        { method: 'PATCH', body: { chapterIds } },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // getChapterContent
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getChapterContent()', () => {
    it('должен запросить контент главы', async () => {
      client._fetchWithRetry.mockResolvedValue('<p>Content</p>');

      await client.getChapterContent(bookId, 'ch-1');

      expect(client._fetchWithRetry).toHaveBeenCalledWith(
        `/api/v1/books/${bookId}/chapters/ch-1/content`,
      );
    });

    it('должен вернуть HTML-контент', async () => {
      const html = '<p>Chapter content here</p>';
      client._fetchWithRetry.mockResolvedValue(html);

      const result = await client.getChapterContent(bookId, 'ch-1');

      expect(result).toBe(html);
    });
  });
});
