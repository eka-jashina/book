/**
 * TESTS: UploadApi
 * Тесты для миксина загрузки файлов
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiClient } from '@utils/ApiClient.js';

describe('UploadApi', () => {
  let client;

  beforeEach(() => {
    client = new ApiClient();
    client._fetch = vi.fn();
    client._fetchWithRetry = vi.fn();
    client._csrfToken = 'test-token';
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // uploadFont
  // ═══════════════════════════════════════════════════════════════════════════

  describe('uploadFont()', () => {
    it('должен отправить POST с FormData и файлом шрифта', async () => {
      const file = new File(['data'], 'font.woff2', { type: 'font/woff2' });
      client._fetchWithRetry.mockResolvedValue({ url: '/fonts/font.woff2' });

      await client.uploadFont(file);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/upload/font', {
        method: 'POST',
        body: expect.any(FormData),
      });

      const formData = client._fetchWithRetry.mock.calls[0][1].body;
      expect(formData.get('file')).toBe(file);
    });

    it('должен вернуть результат загрузки', async () => {
      const file = new File(['data'], 'font.woff2');
      const response = { url: '/fonts/font.woff2', id: 'f1' };
      client._fetchWithRetry.mockResolvedValue(response);

      const result = await client.uploadFont(file);

      expect(result).toEqual(response);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // uploadSound
  // ═══════════════════════════════════════════════════════════════════════════

  describe('uploadSound()', () => {
    it('должен отправить POST с файлом звука', async () => {
      const file = new File(['audio'], 'sound.mp3', { type: 'audio/mpeg' });
      client._fetchWithRetry.mockResolvedValue({ url: '/sounds/sound.mp3' });

      await client.uploadSound(file);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/upload/sound', {
        method: 'POST',
        body: expect.any(FormData),
      });

      const formData = client._fetchWithRetry.mock.calls[0][1].body;
      expect(formData.get('file')).toBe(file);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // uploadImage
  // ═══════════════════════════════════════════════════════════════════════════

  describe('uploadImage()', () => {
    it('должен отправить POST с файлом изображения', async () => {
      const file = new File(['img'], 'photo.jpg', { type: 'image/jpeg' });
      client._fetchWithRetry.mockResolvedValue({ url: '/images/photo.jpg' });

      await client.uploadImage(file);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/upload/image', {
        method: 'POST',
        body: expect.any(FormData),
      });

      const formData = client._fetchWithRetry.mock.calls[0][1].body;
      expect(formData.get('file')).toBe(file);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // uploadBook
  // ═══════════════════════════════════════════════════════════════════════════

  describe('uploadBook()', () => {
    it('должен отправить POST с файлом книги', async () => {
      const file = new File(['book'], 'book.epub', { type: 'application/epub+zip' });
      client._fetchWithRetry.mockResolvedValue({ chapters: [] });

      await client.uploadBook(file);

      expect(client._fetchWithRetry).toHaveBeenCalledWith('/api/v1/upload/book', {
        method: 'POST',
        body: expect.any(FormData),
      });

      const formData = client._fetchWithRetry.mock.calls[0][1].body;
      expect(formData.get('file')).toBe(file);
    });

    it('должен вернуть результат парсинга', async () => {
      const file = new File(['book'], 'book.epub');
      const response = { chapters: [{ id: 'ch1', title: 'Chapter 1' }] };
      client._fetchWithRetry.mockResolvedValue(response);

      const result = await client.uploadBook(file);

      expect(result).toEqual(response);
    });
  });
});
