/**
 * Тесты для ContentLoader
 * Загрузка и кэширование HTML-контента с retry-логикой
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentLoader } from '../../../js/managers/ContentLoader.js';
import { CONFIG } from '../../../js/config.js';

const { MAX_RETRIES, INITIAL_RETRY_DELAY, FETCH_TIMEOUT } = CONFIG.NETWORK;

/**
 * Создаёт мок IndexedDB для тестирования _readAdminConfigFromIDB
 * @param {Object|null} storedValue — значение, возвращаемое из store.get()
 * @param {Object} [options] — параметры поведения мока
 * @param {boolean} [options.openError] — симулировать ошибку открытия БД
 * @param {boolean} [options.getError] — симулировать ошибку чтения из store
 * @param {boolean} [options.txError] — симулировать ошибку создания транзакции
 * @param {boolean} [options.needsUpgrade] — симулировать onupgradeneeded
 */
function createIndexedDBMock(storedValue, options = {}) {
  const { openError = false, getError = false, txError = false, needsUpgrade = false } = options;

  const mockGetReq = {
    result: storedValue,
    onsuccess: null,
    onerror: null,
  };

  const mockStore = {
    get: vi.fn(() => {
      // Запланировать вызов onsuccess/onerror в следующем микротаске
      Promise.resolve().then(() => {
        if (getError) {
          mockGetReq.onerror?.();
        } else {
          mockGetReq.onsuccess?.();
        }
      });
      return mockGetReq;
    }),
  };

  const mockDb = {
    objectStoreNames: {
      contains: vi.fn(() => !needsUpgrade),
    },
    createObjectStore: vi.fn(),
    transaction: vi.fn((storeName, mode) => {
      if (txError) throw new Error('Transaction failed');
      return { objectStore: vi.fn(() => mockStore) };
    }),
    close: vi.fn(),
  };

  const mockRequest = {
    result: mockDb,
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
  };

  const mockIndexedDB = {
    open: vi.fn(() => {
      Promise.resolve().then(() => {
        if (openError) {
          mockRequest.onerror?.();
        } else {
          if (needsUpgrade) {
            mockRequest.onupgradeneeded?.();
          }
          mockRequest.onsuccess?.();
        }
      });
      return mockRequest;
    }),
  };

  return { mockIndexedDB, mockDb, mockStore, mockGetReq };
}

describe('ContentLoader', () => {
  let loader;
  let originalFetch;

  beforeEach(() => {
    vi.useFakeTimers();
    loader = new ContentLoader();
    originalFetch = global.fetch;
  });

  afterEach(() => {
    vi.useRealTimers();
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize empty cache', () => {
      expect(loader.cache.size).toBe(0);
    });

    it('should initialize null controller', () => {
      expect(loader.controller).toBeNull();
    });
  });

  describe('_delay', () => {
    it('should resolve after specified time', async () => {
      const promise = loader._delay(1000, null);
      vi.advanceTimersByTime(1000);
      await expect(promise).resolves.toBeUndefined();
    });

    it('should reject on abort', async () => {
      const controller = new AbortController();
      const promise = loader._delay(1000, controller.signal);

      controller.abort();

      await expect(promise).rejects.toThrow('Aborted');
    });

    it('should clear timeout on abort', async () => {
      const controller = new AbortController();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = loader._delay(1000, controller.signal);
      controller.abort();

      try {
        await promise;
      } catch (e) {
        // expected
      }

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('_fetchWithRetry', () => {
    it('should return text on successful response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<html>content</html>'),
      });

      const result = await loader._fetchWithRetry('test.html', null);
      expect(result).toBe('<html>content</html>');
    });

    it('should retry and throw on 4xx errors', async () => {
      // Note: implementation retries ALL errors including 4xx (despite comment in source)
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
      });

      const resultPromise = loader._fetchWithRetry('notfound.html', null);

      // Attach rejection handler before advancing timers to avoid unhandled rejection warning
      const expectPromise = expect(resultPromise)
        .rejects.toThrow('Failed to load notfound.html after 3 attempts');

      // Wait for all retry delays (exponential backoff)
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY);
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY * 2);

      await expectPromise;

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should retry on 5xx errors', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('success'),
        });
      });

      const resultPromise = loader._fetchWithRetry('test.html', null);

      // First attempt fails, wait for retry delay
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY);
      // Second attempt fails, wait for retry delay (exponential)
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY * 2);

      const result = await resultPromise;
      expect(result).toBe('success');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const resultPromise = loader._fetchWithRetry('test.html', null);

      // Attach rejection handler before advancing timers
      const expectPromise = expect(resultPromise)
        .rejects.toThrow('Failed to load test.html after 3 attempts');

      // Wait for all retry delays (exponential backoff)
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY); // First retry
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY * 2); // Second retry

      await expectPromise;
    });

    it('should not retry on external AbortError', async () => {
      const controller = new AbortController();
      global.fetch = vi.fn().mockImplementation(() => {
        controller.abort();
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });

      await expect(loader._fetchWithRetry('test.html', controller.signal))
        .rejects.toThrow('Aborted');

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should retry on timeout', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation((_url, options) => {
        attempts++;
        if (attempts < 2) {
          // Симулируем зависший запрос — реагируем только на abort
          return new Promise((_, reject) => {
            options?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          });
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('recovered'),
        });
      });

      const resultPromise = loader._fetchWithRetry('test.html', null);

      // Таймаут первой попытки
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT);
      // Задержка перед retry
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY);

      const result = await resultPromise;
      expect(result).toBe('recovered');
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should pass AbortSignal to fetch', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('content'),
      });

      const controller = new AbortController();
      await loader._fetchWithRetry('test.html', controller.signal);

      expect(global.fetch).toHaveBeenCalledWith('test.html', {
        signal: expect.any(AbortSignal),
      });
    });

    it('should retry on network errors', async () => {
      let attempts = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          text: () => Promise.resolve('recovered'),
        });
      });

      const resultPromise = loader._fetchWithRetry('test.html', null);
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY);

      const result = await resultPromise;
      expect(result).toBe('recovered');
    });
  });

  describe('load', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`<content>${url}</content>`),
        })
      );
    });

    it('should load single URL', async () => {
      const result = await loader.load(['page1.html']);
      expect(result).toBe('<article>\n<content>page1.html</content>\n</article>');
    });

    it('should load multiple URLs and join', async () => {
      const result = await loader.load(['page1.html', 'page2.html']);
      expect(result).toBe('<article>\n<content>page1.html</content>\n</article>\n<article>\n<content>page2.html</content>\n</article>');
    });

    it('should cache loaded content', async () => {
      await loader.load(['page1.html']);
      expect(loader.cache.has('page1.html')).toBe(true);
    });

    it('should use cache on subsequent loads', async () => {
      await loader.load(['page1.html']);
      global.fetch.mockClear();

      const result = await loader.load(['page1.html']);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toBe('<article>\n<content>page1.html</content>\n</article>');
    });

    it('should only fetch missing URLs', async () => {
      loader.cache.set('cached.html', '<cached>content</cached>');

      const result = await loader.load(['cached.html', 'new.html']);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith('new.html', expect.any(Object));
      expect(result).toContain('<cached>content</cached>');
      expect(result).toContain('<content>new.html</content>');
    });

    it('should preserve URL order in result', async () => {
      const result = await loader.load(['a.html', 'b.html', 'c.html']);
      const aIdx = result.indexOf('a.html');
      const bIdx = result.indexOf('b.html');
      const cIdx = result.indexOf('c.html');
      expect(aIdx).toBeLessThan(bIdx);
      expect(bIdx).toBeLessThan(cIdx);
    });

    it('should abort previous load', async () => {
      const abortSpy = vi.fn();
      loader.controller = { abort: abortSpy };

      await loader.load(['test.html']);

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should create new AbortController', async () => {
      await loader.load(['test.html']);
      expect(loader.controller).toBeInstanceOf(AbortController);
    });

    it('should load all cached URLs without fetch', async () => {
      loader.cache.set('a.html', 'content-a');
      loader.cache.set('b.html', 'content-b');

      const result = await loader.load(['a.html', 'b.html']);

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toBe('<article>\ncontent-a\n</article>\n<article>\ncontent-b\n</article>');
    });
  });

  describe('clear', () => {
    it('should clear cache', () => {
      loader.cache.set('a.html', 'content');
      loader.cache.set('b.html', 'content');

      loader.clear();

      expect(loader.cache.size).toBe(0);
    });
  });

  describe('destroy', () => {
    it('should abort current load', () => {
      const abortSpy = vi.fn();
      loader.controller = { abort: abortSpy };

      loader.destroy();

      expect(abortSpy).toHaveBeenCalled();
    });

    it('should clear cache', () => {
      loader.cache.set('test.html', 'content');
      loader.destroy();
      expect(loader.cache.size).toBe(0);
    });
  });

  describe('_fetchWithRetry — additional coverage', () => {
    it('should forward external abort to internal timeout controller', async () => {
      const externalController = new AbortController();
      let fetchSignal;

      global.fetch = vi.fn().mockImplementation((_url, options) => {
        fetchSignal = options?.signal;
        // Зависший запрос — ждём abort
        return new Promise((_, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

      const resultPromise = loader._fetchWithRetry('test.html', externalController.signal);
      const expectPromise = expect(resultPromise).rejects.toThrow('Aborted');

      // Внешний abort до таймаута
      externalController.abort();

      await expectPromise;
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should use exponential backoff delays', async () => {
      const delays = [];
      const originalDelay = loader._delay.bind(loader);
      vi.spyOn(loader, '_delay').mockImplementation((ms, signal) => {
        delays.push(ms);
        return originalDelay(ms, signal);
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
      });

      const resultPromise = loader._fetchWithRetry('test.html', null);
      const expectPromise = expect(resultPromise).rejects.toThrow();

      // Advance through retries
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY);
      await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY * 2);

      await expectPromise;

      // Должно быть MAX_RETRIES - 1 задержек (последняя попытка без delay)
      expect(delays).toHaveLength(MAX_RETRIES - 1);
      expect(delays[0]).toBe(INITIAL_RETRY_DELAY);
      expect(delays[1]).toBe(INITIAL_RETRY_DELAY * 2);
    });

    it('should abort delay when external signal is aborted during retry wait', async () => {
      const externalController = new AbortController();
      let fetchCount = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        fetchCount++;
        return Promise.reject(new Error('Network error'));
      });

      const resultPromise = loader._fetchWithRetry('test.html', externalController.signal);
      const expectPromise = expect(resultPromise).rejects.toThrow('Aborted');

      // Первая попытка — network error, начинается delay
      await vi.advanceTimersByTimeAsync(0);
      // Abort во время ожидания retry delay
      externalController.abort();

      await expectPromise;
      expect(fetchCount).toBe(1);
    });

    it('should clean up timeout and event listeners in finally block', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('content'),
      });

      const controller = new AbortController();
      const removeEventListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');

      await loader._fetchWithRetry('test.html', controller.signal);

      // clearTimeout должен быть вызван в finally
      expect(clearTimeoutSpy).toHaveBeenCalled();
      // removeEventListener должен быть вызван для очистки onExternalAbort
      expect(removeEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('should include timeout message in final error when last attempt times out', async () => {
      global.fetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_, reject) => {
          options?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      });

      const resultPromise = loader._fetchWithRetry('api/data', null);

      // Attach rejection handler before advancing timers to avoid unhandled rejection
      const expectPromise = expect(resultPromise).rejects.toThrow(/Request timeout/);

      // Все 3 попытки — таймаут
      for (let i = 0; i < MAX_RETRIES; i++) {
        await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT);
        if (i < MAX_RETRIES - 1) {
          await vi.advanceTimersByTimeAsync(INITIAL_RETRY_DELAY * Math.pow(2, i));
        }
      }

      await expectPromise;
    });
  });

  describe('load — chapter objects and inline content', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`<content>${url}</content>`),
        })
      );
    });

    it('should accept chapter objects with file property', async () => {
      const result = await loader.load([{ file: 'page1.html' }]);
      expect(result).toBe('<article>\n<content>page1.html</content>\n</article>');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle mixed strings and objects', async () => {
      const result = await loader.load([
        'page1.html',
        { file: 'page2.html' },
      ]);
      expect(result).toContain('page1.html');
      expect(result).toContain('page2.html');
    });

    it('should cache inline htmlContent under file key', async () => {
      const result = await loader.load([
        { file: 'ch1', htmlContent: '<p>inline content</p>' },
      ]);

      expect(result).toBe('<article>\n<p>inline content</p>\n</article>');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(loader.cache.get('ch1')).toBe('<p>inline content</p>');
    });

    it('should use __inline_ key when file is missing but id is present', async () => {
      const result = await loader.load([
        { htmlContent: '<p>no file</p>', id: 'chapter-42' },
      ]);

      expect(result).toBe('<article>\n<p>no file</p>\n</article>');
      expect(loader.cache.has('__inline_chapter-42')).toBe(true);
    });

    it('should use __inline_ key when both file and id are missing', async () => {
      const result = await loader.load([
        { htmlContent: '<p>anonymous</p>' },
      ]);

      expect(result).toBe('<article>\n<p>anonymous</p>\n</article>');
      expect(loader.cache.has('__inline_')).toBe(true);
    });

    it('should mix inline content with fetched URLs', async () => {
      const result = await loader.load([
        { file: 'ch1', htmlContent: '<p>inline</p>' },
        { file: 'remote.html' },
      ]);

      expect(result).toBe('<article>\n<p>inline</p>\n</article>\n<article>\n<content>remote.html</content>\n</article>');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should not fetch items that have htmlContent', async () => {
      await loader.load([
        { file: 'same.html', htmlContent: '<p>already loaded</p>' },
      ]);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should handle items with _idb flag that already have htmlContent', async () => {
      // _idb=true but htmlContent is already present → no IDB loading needed
      const spy = vi.spyOn(loader, '_loadChaptersFromIDB');

      const result = await loader.load([
        { file: 'ch1', _idb: true, htmlContent: '<p>preloaded</p>', id: 'ch1' },
      ]);

      expect(spy).not.toHaveBeenCalled();
      expect(result).toBe('<article>\n<p>preloaded</p>\n</article>');
    });

    it('should call _loadChaptersFromIDB for _idb items without htmlContent', async () => {
      vi.spyOn(loader, '_loadChaptersFromIDB').mockResolvedValue();

      await loader.load([
        { file: 'ch1', _idb: true, id: 'ch1' },
      ]);

      expect(loader._loadChaptersFromIDB).toHaveBeenCalledWith([
        expect.objectContaining({ file: 'ch1', _idb: true, id: 'ch1' }),
      ]);
    });

    it('should use htmlContent from IDB after loading', async () => {
      // Мокаем _loadChaptersFromIDB — он подставляет htmlContent в items
      vi.spyOn(loader, '_loadChaptersFromIDB').mockImplementation(async (items) => {
        for (const item of items) {
          item.htmlContent = '<p>from IDB</p>';
        }
      });

      const result = await loader.load([
        { file: 'ch1', _idb: true, id: 'ch1' },
      ]);

      expect(result).toBe('<article>\n<p>from IDB</p>\n</article>');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should fetch items without file or htmlContent as empty', async () => {
      // Item без file и без htmlContent — cache key = undefined, не попадает в missing
      const result = await loader.load([
        { file: 'page.html' },
        { htmlContent: '<p>inline</p>', id: 'x' },
      ]);

      // Both items are present, each wrapped in <article>
      expect(result).toContain('page.html');
      expect(result).toContain('<p>inline</p>');
      // Two <article> blocks
      expect(result.match(/<article>/g)).toHaveLength(2);
    });
  });

  describe('_loadChaptersFromIDB', () => {
    it('should return without modifying items when config is null', async () => {
      vi.spyOn(loader, '_readAdminConfigFromIDB').mockResolvedValue(null);

      const items = [{ id: 'ch1', _idb: true }];
      await loader._loadChaptersFromIDB(items);

      expect(items[0].htmlContent).toBeUndefined();
    });

    it('should return without modifying items when books array is missing', async () => {
      vi.spyOn(loader, '_readAdminConfigFromIDB').mockResolvedValue({});

      const items = [{ id: 'ch1', _idb: true }];
      await loader._loadChaptersFromIDB(items);

      expect(items[0].htmlContent).toBeUndefined();
    });

    it('should find book by activeBookId', async () => {
      vi.spyOn(loader, '_readAdminConfigFromIDB').mockResolvedValue({
        activeBookId: 'book-2',
        books: [
          { id: 'book-1', chapters: [{ id: 'ch1', htmlContent: '<p>wrong book</p>' }] },
          { id: 'book-2', chapters: [{ id: 'ch1', htmlContent: '<p>correct book</p>' }] },
        ],
      });

      const items = [{ id: 'ch1', _idb: true }];
      await loader._loadChaptersFromIDB(items);

      expect(items[0].htmlContent).toBe('<p>correct book</p>');
    });

    it('should fallback to first book when activeBookId does not match', async () => {
      vi.spyOn(loader, '_readAdminConfigFromIDB').mockResolvedValue({
        activeBookId: 'nonexistent',
        books: [
          { id: 'book-1', chapters: [{ id: 'ch1', htmlContent: '<p>first book</p>' }] },
        ],
      });

      const items = [{ id: 'ch1', _idb: true }];
      await loader._loadChaptersFromIDB(items);

      expect(items[0].htmlContent).toBe('<p>first book</p>');
    });

    it('should return when book has no chapters', async () => {
      vi.spyOn(loader, '_readAdminConfigFromIDB').mockResolvedValue({
        activeBookId: 'book-1',
        books: [{ id: 'book-1' }],
      });

      const items = [{ id: 'ch1', _idb: true }];
      await loader._loadChaptersFromIDB(items);

      expect(items[0].htmlContent).toBeUndefined();
    });

    it('should skip chapters without id or htmlContent', async () => {
      vi.spyOn(loader, '_readAdminConfigFromIDB').mockResolvedValue({
        activeBookId: 'book-1',
        books: [{
          id: 'book-1',
          chapters: [
            { id: 'ch1' },                                    // нет htmlContent
            { htmlContent: '<p>no id</p>' },                   // нет id
            { id: 'ch2', htmlContent: '<p>valid</p>' },       // валидная
          ],
        }],
      });

      const items = [
        { id: 'ch1', _idb: true },
        { id: 'ch2', _idb: true },
      ];
      await loader._loadChaptersFromIDB(items);

      expect(items[0].htmlContent).toBeUndefined();
      expect(items[1].htmlContent).toBe('<p>valid</p>');
    });

    it('should not modify items when their id is not found in book chapters', async () => {
      vi.spyOn(loader, '_readAdminConfigFromIDB').mockResolvedValue({
        activeBookId: 'book-1',
        books: [{
          id: 'book-1',
          chapters: [{ id: 'ch-other', htmlContent: '<p>other</p>' }],
        }],
      });

      const items = [{ id: 'ch-missing', _idb: true }];
      await loader._loadChaptersFromIDB(items);

      expect(items[0].htmlContent).toBeUndefined();
    });

    it('should warn on error and not throw', async () => {
      vi.spyOn(loader, '_readAdminConfigFromIDB').mockRejectedValue(new Error('IDB error'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const items = [{ id: 'ch1', _idb: true }];
      await expect(loader._loadChaptersFromIDB(items)).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledWith(
        'ContentLoader: не удалось загрузить контент из IndexedDB',
        expect.any(Error)
      );
    });
  });

  describe('_readAdminConfigFromIDB', () => {
    let originalIndexedDB;

    beforeEach(() => {
      originalIndexedDB = global.indexedDB;
    });

    afterEach(() => {
      global.indexedDB = originalIndexedDB;
    });

    it('should return config value from IndexedDB', async () => {
      const configData = { books: [], activeBookId: 'b1' };
      const { mockIndexedDB } = createIndexedDBMock(configData);
      global.indexedDB = mockIndexedDB;

      const result = await loader._readAdminConfigFromIDB();

      expect(result).toEqual(configData);
      expect(mockIndexedDB.open).toHaveBeenCalledWith('flipbook-admin', 1);
    });

    it('should return null when stored value is undefined', async () => {
      const { mockIndexedDB } = createIndexedDBMock(undefined);
      global.indexedDB = mockIndexedDB;

      const result = await loader._readAdminConfigFromIDB();

      expect(result).toBeNull();
    });

    it('should return null on open error', async () => {
      const { mockIndexedDB } = createIndexedDBMock(null, { openError: true });
      global.indexedDB = mockIndexedDB;

      const result = await loader._readAdminConfigFromIDB();

      expect(result).toBeNull();
    });

    it('should return null on get error', async () => {
      const { mockIndexedDB } = createIndexedDBMock(null, { getError: true });
      global.indexedDB = mockIndexedDB;

      const result = await loader._readAdminConfigFromIDB();

      expect(result).toBeNull();
    });

    it('should return null on transaction error', async () => {
      const { mockIndexedDB } = createIndexedDBMock(null, { txError: true });
      global.indexedDB = mockIndexedDB;

      const result = await loader._readAdminConfigFromIDB();

      expect(result).toBeNull();
    });

    it('should create object store on upgrade if not exists', async () => {
      const { mockIndexedDB, mockDb } = createIndexedDBMock({ data: true }, { needsUpgrade: true });
      global.indexedDB = mockIndexedDB;

      await loader._readAdminConfigFromIDB();

      expect(mockDb.createObjectStore).toHaveBeenCalledWith('config');
    });

    it('should not create object store on upgrade if already exists', async () => {
      // needsUpgrade=false → objectStoreNames.contains returns true
      const configData = { books: [] };
      const { mockIndexedDB, mockDb } = createIndexedDBMock(configData);
      global.indexedDB = mockIndexedDB;

      await loader._readAdminConfigFromIDB();

      expect(mockDb.createObjectStore).not.toHaveBeenCalled();
    });

    it('should return null when indexedDB.open throws synchronously', async () => {
      global.indexedDB = {
        open: vi.fn(() => { throw new Error('SecurityError'); }),
      };

      const result = await loader._readAdminConfigFromIDB();

      expect(result).toBeNull();
    });

    it('should close db after successful get', async () => {
      const { mockIndexedDB, mockDb } = createIndexedDBMock({ books: [] });
      global.indexedDB = mockIndexedDB;

      await loader._readAdminConfigFromIDB();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should close db after get error', async () => {
      const { mockIndexedDB, mockDb } = createIndexedDBMock(null, { getError: true });
      global.indexedDB = mockIndexedDB;

      await loader._readAdminConfigFromIDB();

      expect(mockDb.close).toHaveBeenCalled();
    });

    it('should close db after transaction error', async () => {
      const { mockIndexedDB, mockDb } = createIndexedDBMock(null, { txError: true });
      global.indexedDB = mockIndexedDB;

      await loader._readAdminConfigFromIDB();

      expect(mockDb.close).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // constructor options
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor options', () => {
    it('should store apiClient', () => {
      const api = { getChapterContent: vi.fn() };
      const l = new ContentLoader({ apiClient: api });
      expect(l._api).toBe(api);
    });

    it('should store bookId', () => {
      const l = new ContentLoader({ bookId: 'b-123' });
      expect(l._bookId).toBe('b-123');
    });

    it('should store publicMode', () => {
      const l = new ContentLoader({ publicMode: true });
      expect(l._publicMode).toBe(true);
    });

    it('should default apiClient to null', () => {
      expect(loader._api).toBeNull();
    });

    it('should default bookId to null', () => {
      expect(loader._bookId).toBeNull();
    });

    it('should default publicMode to false', () => {
      expect(loader._publicMode).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _fetchChapterFromAPI
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_fetchChapterFromAPI', () => {
    it('should call getChapterContent for non-public mode', async () => {
      const api = {
        getChapterContent: vi.fn().mockResolvedValue({ html: '<p>content</p>' }),
        getPublicChapterContent: vi.fn(),
      };
      const l = new ContentLoader({ apiClient: api, bookId: 'b1' });

      const result = await l._fetchChapterFromAPI('ch1');

      expect(api.getChapterContent).toHaveBeenCalledWith('b1', 'ch1');
      expect(api.getPublicChapterContent).not.toHaveBeenCalled();
      expect(result).toBe('<p>content</p>');
    });

    it('should call getPublicChapterContent for public mode', async () => {
      const api = {
        getChapterContent: vi.fn(),
        getPublicChapterContent: vi.fn().mockResolvedValue({ html: '<p>public</p>' }),
      };
      const l = new ContentLoader({ apiClient: api, bookId: 'b1', publicMode: true });

      const result = await l._fetchChapterFromAPI('ch1');

      expect(api.getPublicChapterContent).toHaveBeenCalledWith('b1', 'ch1');
      expect(api.getChapterContent).not.toHaveBeenCalled();
      expect(result).toBe('<p>public</p>');
    });

    it('should handle response with htmlContent field', async () => {
      const api = {
        getChapterContent: vi.fn().mockResolvedValue({ htmlContent: '<p>htmlContent</p>' }),
      };
      const l = new ContentLoader({ apiClient: api, bookId: 'b1' });

      const result = await l._fetchChapterFromAPI('ch1');
      expect(result).toBe('<p>htmlContent</p>');
    });

    it('should handle response with content field', async () => {
      const api = {
        getChapterContent: vi.fn().mockResolvedValue({ content: '<p>content field</p>' }),
      };
      const l = new ContentLoader({ apiClient: api, bookId: 'b1' });

      const result = await l._fetchChapterFromAPI('ch1');
      expect(result).toBe('<p>content field</p>');
    });

    it('should handle string response directly', async () => {
      const api = {
        getChapterContent: vi.fn().mockResolvedValue('<p>direct string</p>'),
      };
      const l = new ContentLoader({ apiClient: api, bookId: 'b1' });

      const result = await l._fetchChapterFromAPI('ch1');
      expect(result).toBe('<p>direct string</p>');
    });

    it('should return empty string for object without known fields', async () => {
      const api = {
        getChapterContent: vi.fn().mockResolvedValue({ unknown: 'data' }),
      };
      const l = new ContentLoader({ apiClient: api, bookId: 'b1' });

      const result = await l._fetchChapterFromAPI('ch1');
      expect(result).toBe('');
    });

    it('should prioritize html over htmlContent over content', async () => {
      const api = {
        getChapterContent: vi.fn().mockResolvedValue({
          html: '<p>html</p>',
          htmlContent: '<p>htmlContent</p>',
          content: '<p>content</p>',
        }),
      };
      const l = new ContentLoader({ apiClient: api, bookId: 'b1' });

      const result = await l._fetchChapterFromAPI('ch1');
      expect(result).toBe('<p>html</p>');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // load — API mode
  // ═══════════════════════════════════════════════════════════════════════════

  describe('load — API mode', () => {
    let apiLoader;
    let mockApi;

    beforeEach(() => {
      mockApi = {
        getChapterContent: vi.fn().mockResolvedValue({ html: '<article><p>api content</p></article>' }),
        getPublicChapterContent: vi.fn().mockResolvedValue({ html: '<article><p>public</p></article>' }),
      };
      apiLoader = new ContentLoader({ apiClient: mockApi, bookId: 'b1' });
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<content>fetched</content>'),
      });
    });

    it('should load chapters with _hasHtmlContent via API', async () => {
      const result = await apiLoader.load([
        { id: 'ch1', _hasHtmlContent: true },
      ]);

      expect(mockApi.getChapterContent).toHaveBeenCalledWith('b1', 'ch1');
      expect(result).toContain('api content');
    });

    it('should cache API results with api: prefix', async () => {
      await apiLoader.load([{ id: 'ch1', _hasHtmlContent: true }]);

      expect(apiLoader.cache.has('api:ch1')).toBe(true);
    });

    it('should skip API fetch for already cached chapters', async () => {
      apiLoader.cache.set('api:ch1', '<article><p>cached</p></article>');

      await apiLoader.load([{ id: 'ch1', _hasHtmlContent: true }]);

      expect(mockApi.getChapterContent).not.toHaveBeenCalled();
    });

    it('should warn on API fetch failure and continue', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockApi.getChapterContent
        .mockResolvedValueOnce({ html: '<article><p>ok</p></article>' })  // ch1 OK
        .mockRejectedValueOnce(new Error('Network'));                      // ch2 fails

      await apiLoader.load([
        { id: 'ch1', _hasHtmlContent: true },
        { id: 'ch2', _hasHtmlContent: true },
      ]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('ch2'),
        expect.any(Error)
      );
    });

    it('should use public API in publicMode', async () => {
      const publicLoader = new ContentLoader({ apiClient: mockApi, bookId: 'b1', publicMode: true });

      await publicLoader.load([{ id: 'ch1', _hasHtmlContent: true }]);

      expect(mockApi.getPublicChapterContent).toHaveBeenCalledWith('b1', 'ch1');
      expect(mockApi.getChapterContent).not.toHaveBeenCalled();
    });

    it('should handle mixed API and static file chapters', async () => {
      const result = await apiLoader.load([
        { id: 'ch1', _hasHtmlContent: true },
        { file: 'static.html' },
      ]);

      expect(mockApi.getChapterContent).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(result).toContain('api content');
      expect(result).toContain('fetched');
    });

    it('should handle inline htmlContent in API mode', async () => {
      const result = await apiLoader.load([
        { file: 'inline', htmlContent: '<p>inline data</p>' },
      ]);

      expect(result).toContain('inline data');
      expect(mockApi.getChapterContent).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // load — article wrapping and title insertion
  // ═══════════════════════════════════════════════════════════════════════════

  describe('load — article wrapping', () => {
    beforeEach(() => {
      global.fetch = vi.fn().mockImplementation((url) =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`<content>${url}</content>`),
        })
      );
    });

    it('should not wrap content that starts with <article', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<article><p>already wrapped</p></article>'),
      });

      const result = await loader.load(['ch.html']);
      // Должен вернуть как есть, без двойной обёртки
      expect(result).toBe('<article><p>already wrapped</p></article>');
      expect(result.match(/<article/g)).toHaveLength(1);
    });

    it('should wrap non-article content in <article> tags', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<p>plain content</p>'),
      });

      const result = await loader.load(['ch.html']);
      expect(result).toBe('<article>\n<p>plain content</p>\n</article>');
    });

    it('should add h2 heading from chapter title when wrapping', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<p>content</p>'),
      });

      const result = await loader.load([{ file: 'ch.html', title: 'Chapter One' }]);
      expect(result).toBe('<article>\n<h2>Chapter One</h2>\n<p>content</p>\n</article>');
    });

    it('should not add heading when title is missing', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('<p>content</p>'),
      });

      const result = await loader.load([{ file: 'ch.html' }]);
      expect(result).not.toContain('<h2>');
    });

  });

  describe('integration', () => {
    it('should handle concurrent loads', async () => {
      global.fetch = vi.fn().mockImplementation((url) =>
        Promise.resolve({
          ok: true,
          text: () => Promise.resolve(`<content>${url}</content>`),
        })
      );

      // Start first load
      const load1 = loader.load(['slow.html']);
      // Start second load (should abort first)
      const load2 = loader.load(['fast.html']);

      const result = await load2;
      expect(result).toContain('fast.html');
    });
  });
});
