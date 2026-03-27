/**
 * INTEGRATION TEST: Concurrent Chapter Loading
 * Тестирование параллельной загрузки глав и race conditions:
 * - Параллельная загрузка нескольких URL
 * - Abort предыдущей загрузки при новой
 * - Кэширование загруженных глав
 * - Retry с exponential backoff
 * - Смешанный контент (URL + inline + API)
 * - Partial failure (часть глав загружена, часть нет)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { flushPromises } from '../../helpers/testUtils.js';

// Mock config с NETWORK settings
vi.mock('../../../js/config.js', async (importOriginal) => {
  const actual = await importOriginal();
  const CONFIG = {
    ...actual.CONFIG,
    NETWORK: {
      MAX_RETRIES: 3,
      INITIAL_RETRY_DELAY: 10, // ms (ускоренное для тестов)
      FETCH_TIMEOUT: 500,
    },
  };
  return { ...actual, CONFIG, getConfig: () => CONFIG };
});

describe('Concurrent Chapter Loading', () => {
  let loader;

  beforeEach(() => {
    loader = new ContentLoader();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    loader?.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════
  // ПАРАЛЛЕЛЬНАЯ ЗАГРУЗКА
  // ═══════════════════════════════════════════

  describe('Parallel URL fetching', () => {
    it('should fetch all chapters in parallel', async () => {
      const fetchCalls = [];

      global.fetch = vi.fn().mockImplementation((url) => {
        fetchCalls.push(url);
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`<article><p>Content of ${url}</p></article>`),
        });
      });

      const chapters = [
        { file: 'ch1.html', title: 'Ch 1' },
        { file: 'ch2.html', title: 'Ch 2' },
        { file: 'ch3.html', title: 'Ch 3' },
      ];

      const result = await loader.load(chapters);

      // Все 3 fetch-а запущены
      expect(fetchCalls).toHaveLength(3);
      expect(fetchCalls).toContain('ch1.html');
      expect(fetchCalls).toContain('ch2.html');
      expect(fetchCalls).toContain('ch3.html');

      // Результат — объединённый HTML
      expect(result).toContain('Content of ch1.html');
      expect(result).toContain('Content of ch3.html');
    });

    it('should return chapters in correct order regardless of fetch completion order', async () => {
      // ch2 загружается медленнее ch1 и ch3
      global.fetch = vi.fn().mockImplementation((url) => {
        const delay = url === 'ch2.html' ? 100 : 10;
        return new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            text: () => Promise.resolve(`<article data-id="${url}"><p>${url}</p></article>`),
          }), delay);
        });
      });

      const chapters = [
        { file: 'ch1.html' },
        { file: 'ch2.html' },
        { file: 'ch3.html' },
      ];

      const resultPromise = loader.load(chapters);
      await vi.advanceTimersByTimeAsync(200);
      const result = await resultPromise;

      // Порядок в результате должен соответствовать порядку chapters
      const ch1Pos = result.indexOf('ch1.html');
      const ch2Pos = result.indexOf('ch2.html');
      const ch3Pos = result.indexOf('ch3.html');

      expect(ch1Pos).toBeLessThan(ch2Pos);
      expect(ch2Pos).toBeLessThan(ch3Pos);
    });
  });

  // ═══════════════════════════════════════════
  // ABORT ПРЕДЫДУЩЕЙ ЗАГРУЗКИ
  // ═══════════════════════════════════════════

  describe('Abort previous loading on new load', () => {
    it('should abort previous controller when new load starts', async () => {
      let abortCount = 0;

      global.fetch = vi.fn().mockImplementation((url, opts) => {
        opts?.signal?.addEventListener('abort', () => { abortCount++; });
        return new Promise((resolve) => {
          setTimeout(() => resolve({
            ok: true,
            text: () => Promise.resolve('<article>OK</article>'),
          }), 200);
        });
      });

      // Первая загрузка
      const firstLoad = loader.load([{ file: 'slow.html' }]);
      firstLoad.catch(() => {}); // Поглощаем отклонение при abort

      // Вторая загрузка (отменяет первую)
      const secondLoad = loader.load([{ file: 'fast.html' }]);

      await vi.advanceTimersByTimeAsync(300);

      // Первый controller должен быть отменён
      expect(abortCount).toBeGreaterThanOrEqual(1);

      // Вторая загрузка должна завершиться
      const result = await secondLoad;
      expect(result).toContain('OK');
    });

    it('should start each load independently without aborting the previous result', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<article>Content</article>'),
      });

      // Обе загрузки завершаются успешно и независимо
      const result1 = await loader.load([{ file: 'a.html' }]);
      const result2 = await loader.load([{ file: 'b.html' }]);

      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════
  // КЭШИРОВАНИЕ
  // ═══════════════════════════════════════════

  describe('Caching', () => {
    it('should not re-fetch already cached URLs', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<article>Cached content</article>'),
      });

      // Первая загрузка
      await loader.load([{ file: 'ch1.html' }, { file: 'ch2.html' }]);
      expect(global.fetch).toHaveBeenCalledTimes(2);

      global.fetch.mockClear();

      // Вторая загрузка — ch1 уже в кэше, загружаем только ch3
      await loader.load([{ file: 'ch1.html' }, { file: 'ch3.html' }]);

      // Только ch3 должен быть загружен
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('ch3.html', expect.any(Object));
    });

    it('should clear cache on clear()', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<article>Content</article>'),
      });

      // Первая загрузка — файл закэширован
      await loader.load([{ file: 'ch1.html' }]);
      global.fetch.mockClear();

      // Без clear — повторный load не делает fetch (из кэша)
      await loader.load([{ file: 'ch1.html' }]);
      expect(global.fetch).not.toHaveBeenCalled();

      // После clear — файл запрашивается снова
      loader.clear();
      await loader.load([{ file: 'ch1.html' }]);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════
  // RETRY С EXPONENTIAL BACKOFF
  // ═══════════════════════════════════════════

  describe('Retry with exponential backoff', () => {
    it('should retry on server error (5xx)', async () => {
      let attempts = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({ ok: false, status: 500, statusText: 'Internal Server Error' });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('<article>Success after retry</article>'),
        });
      });

      const resultPromise = loader.load([{ file: 'retry.html' }]);

      // Продвигаем таймеры для retry delays
      await vi.advanceTimersByTimeAsync(100);
      await flushPromises();
      await vi.advanceTimersByTimeAsync(200);
      await flushPromises();

      const result = await resultPromise;

      expect(attempts).toBe(3);
      expect(result).toContain('Success after retry');
    });

    it('should throw with details on client error (4xx) after retries', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 404, statusText: 'Not Found',
      });

      const resultPromise = loader.load([{ file: 'missing.html' }]);
      // Предотвращаем unhandled rejection warning при retry
      resultPromise.catch(() => {});

      // Продвигаем retry delays
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(500);
        await flushPromises();
      }

      await expect(resultPromise).rejects.toThrow(/Failed to load/);
    });

    it('should throw after MAX_RETRIES attempts exhausted', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false, status: 500, statusText: 'Server Error',
      });

      const resultPromise = loader.load([{ file: 'always-fail.html' }]);
      // Предотвращаем unhandled rejection warning при retry
      resultPromise.catch(() => {});

      // Продвигаем все retry delays
      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(500);
        await flushPromises();
      }

      await expect(resultPromise).rejects.toThrow(/Failed to load/);
      expect(global.fetch).toHaveBeenCalledTimes(3); // MAX_RETRIES=3
    });
  });

  // ═══════════════════════════════════════════
  // INLINE КОНТЕНТ
  // ═══════════════════════════════════════════

  describe('Inline content (htmlContent)', () => {
    it('should use inline content without fetch', async () => {
      global.fetch = vi.fn();

      const chapters = [
        { file: 'ch1.html', htmlContent: '<article>Inline chapter 1</article>' },
        { file: 'ch2.html', htmlContent: '<article>Inline chapter 2</article>' },
      ];

      const result = await loader.load(chapters);

      // fetch не вызван
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toContain('Inline chapter 1');
      expect(result).toContain('Inline chapter 2');
    });

    it('should mix inline and URL content', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<article>Fetched chapter</article>'),
      });

      const chapters = [
        { file: 'ch1.html', htmlContent: '<article>Inline</article>' },
        { file: 'ch2.html' }, // загружается через fetch
      ];

      const result = await loader.load(chapters);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('ch2.html', expect.any(Object));
      expect(result).toContain('Inline');
      expect(result).toContain('Fetched chapter');
    });

    it('should wrap non-article content in article tags', async () => {
      global.fetch = vi.fn();

      const chapters = [
        { file: 'ch1.html', title: 'Глава 1', htmlContent: '<p>Текст без article</p>' },
      ];

      const result = await loader.load(chapters);

      expect(result).toContain('<article>');
      expect(result).toContain('<h2>Глава 1</h2>');
      expect(result).toContain('Текст без article');
    });
  });

  // ═══════════════════════════════════════════
  // API MODE (серверная загрузка глав)
  // ═══════════════════════════════════════════

  describe('API mode (server chapter loading)', () => {
    let mockApiClient;

    beforeEach(() => {
      mockApiClient = {
        getChapterContent: vi.fn().mockResolvedValue({ html: '<article>API Chapter</article>' }),
        getPublicChapterContent: vi.fn().mockResolvedValue({ html: '<article>Public Chapter</article>' }),
      };
    });

    it('should load chapters via API when apiClient is provided', async () => {
      const apiLoader = new ContentLoader({ apiClient: mockApiClient, bookId: 'book-1' });

      const chapters = [
        { id: 'ch-1', _hasHtmlContent: true, title: 'Глава 1' },
        { id: 'ch-2', _hasHtmlContent: true, title: 'Глава 2' },
      ];

      const result = await apiLoader.load(chapters);

      expect(mockApiClient.getChapterContent).toHaveBeenCalledWith('book-1', 'ch-1');
      expect(mockApiClient.getChapterContent).toHaveBeenCalledWith('book-1', 'ch-2');
      expect(result).toContain('API Chapter');

      apiLoader.destroy();
    });

    it('should use public API in public mode', async () => {
      const publicLoader = new ContentLoader({
        apiClient: mockApiClient, bookId: 'book-1', publicMode: true,
      });

      await publicLoader.load([{ id: 'ch-1', _hasHtmlContent: true }]);

      expect(mockApiClient.getPublicChapterContent).toHaveBeenCalledWith('book-1', 'ch-1');
      expect(mockApiClient.getChapterContent).not.toHaveBeenCalled();

      publicLoader.destroy();
    });

    it('should cache API chapters and not re-fetch', async () => {
      const apiLoader = new ContentLoader({ apiClient: mockApiClient, bookId: 'book-1' });

      const chapters = [{ id: 'ch-1', _hasHtmlContent: true }];

      await apiLoader.load(chapters);
      mockApiClient.getChapterContent.mockClear();

      // Повторная загрузка — из кэша
      await apiLoader.load(chapters);

      expect(mockApiClient.getChapterContent).not.toHaveBeenCalled();

      apiLoader.destroy();
    });

    it('should handle partial API failure gracefully', async () => {
      mockApiClient.getChapterContent
        .mockResolvedValueOnce({ html: '<article>OK Chapter</article>' })
        .mockRejectedValueOnce(new Error('API error'));

      const apiLoader = new ContentLoader({ apiClient: mockApiClient, bookId: 'book-1' });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const chapters = [
        { id: 'ch-1', _hasHtmlContent: true },
        { id: 'ch-2', _hasHtmlContent: true },
      ];

      const result = await apiLoader.load(chapters);

      // Первая глава загружена, вторая — нет
      expect(result).toContain('OK Chapter');
      expect(consoleSpy).toHaveBeenCalled();

      apiLoader.destroy();
      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════
  // RACE CONDITIONS
  // ═══════════════════════════════════════════

  describe('Race conditions', () => {
    it('should handle rapid open→close→open without data corruption', async () => {
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation((url) => {
        callCount++;
        const currentCall = callCount;
        return new Promise(resolve => {
          setTimeout(() => resolve({
            ok: true,
            text: () => Promise.resolve(`<article>Call ${currentCall}: ${url}</article>`),
          }), 50);
        });
      });

      // Первая загрузка (будет отменена)
      const firstLoad = loader.load([{ file: 'chapter.html' }]);

      // Сразу abort (симуляция закрытия книги)
      loader.abort();

      // Вторая загрузка (будет снова отменена)
      loader.clear();
      const secondLoad = loader.load([{ file: 'chapter.html' }]);

      // Опять abort
      loader.abort();

      // Третья загрузка (финальная)
      loader.clear();
      const thirdLoad = loader.load([{ file: 'chapter.html' }]);

      await vi.advanceTimersByTimeAsync(200);

      // Дожидаемся отменённых загрузок
      await firstLoad.catch(() => {});
      await secondLoad.catch(() => {});

      const result = await thirdLoad;

      // Результат должен быть от последней загрузки
      expect(result).toContain('chapter.html');
    });

    it('should not mix chapters from different load calls', async () => {
      global.fetch = vi.fn().mockImplementation((url, opts) => {
        return new Promise((resolve, reject) => {
          const delay = url.includes('slow') ? 200 : 10;
          const timeoutId = setTimeout(() => resolve({
            ok: true,
            text: () => Promise.resolve(`<article>${url}</article>`),
          }), delay);
          opts?.signal?.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

      // Первая загрузка с медленной главой (будет отменена)
      const firstLoad = loader.load([{ file: 'slow-ch1.html' }, { file: 'slow-ch2.html' }]);
      firstLoad.catch(() => {}); // Предотвращаем unhandled rejection при abort

      // Новая загрузка отменяет предыдущую
      const secondLoad = loader.load([{ file: 'fast-ch1.html' }]);

      await vi.advanceTimersByTimeAsync(300);

      const html = await secondLoad;

      // Результат содержит только главы из второго вызова
      expect(html).toContain('fast-ch1.html');
      expect(html).not.toContain('slow-ch1.html');
    });
  });

  // ═══════════════════════════════════════════
  // ABORT MANUAL
  // ═══════════════════════════════════════════

  describe('Manual abort', () => {
    it('should cancel in-flight fetch on abort()', async () => {
      let aborted = false;

      global.fetch = vi.fn().mockImplementation((url, opts) => {
        return new Promise((resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          });
          setTimeout(() => resolve({
            ok: true,
            text: () => Promise.resolve('<article>Should not complete</article>'),
          }), 1000);
        });
      });

      const loadPromise = loader.load([{ file: 'slow.html' }]);
      loadPromise.catch(() => {}); // Предотвращаем unhandled rejection при abort

      // Abort до завершения
      loader.abort();

      await vi.advanceTimersByTimeAsync(1100);
      await flushPromises();

      expect(aborted).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════

  describe('Destroy', () => {
    it('should abort ongoing requests on destroy', async () => {
      let capturedSignal;
      global.fetch = vi.fn().mockImplementation((_url, opts) => {
        capturedSignal = opts?.signal;
        return new Promise(() => {}); // загрузка не завершается
      });

      loader.load([{ file: 'ch1.html' }]); // не await

      expect(capturedSignal?.aborted).toBe(false);

      loader.destroy();

      // AbortSignal должен быть прерван
      expect(capturedSignal?.aborted).toBe(true);
    });
  });

  // ═══════════════════════════════════════════
  // BACKWARD COMPATIBILITY
  // ═══════════════════════════════════════════

  describe('Backward compatibility (string URLs)', () => {
    it('should handle array of URL strings', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<article>Legacy content</article>'),
      });

      const result = await loader.load(['ch1.html', 'ch2.html']);

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toContain('Legacy content');
    });
  });
});
