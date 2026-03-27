/**
 * INTEGRATION TEST: IdbStorage Quota & Migration
 * Переполнение хранилища → graceful degradation; миграция localStorage → IndexedDB:
 * - Базовые CRUD операции через IdbStorage
 * - Переполнение IndexedDB → ошибка без краша
 * - Idle timeout → автозакрытие соединения
 * - Конкурентные операции на одном соединении
 * - Connection recovery после versionchange/close
 * - Destroy корректно закрывает соединение
 * - Миграция данных localStorage → IndexedDB
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IdbStorage } from '../../../js/utils/IdbStorage.js';
import { flushPromises, advanceTimersAndFlush } from '../../helpers/testUtils.js';

/**
 * Фабрика мока IndexedDB.
 * Создаёт минимальную in-memory имплементацию для тестирования IdbStorage.
 * Ошибки пробрасываются через стандартный механизм tx.onerror → reject.
 */
function createMockIndexedDB() {
  const stores = new Map();
  let _failOnPut = false;

  const createStore = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  };

  const createTransaction = (storeName, mode) => {
    const data = createStore(storeName);
    let shouldFail = _failOnPut && mode === 'readwrite';

    const tx = {
      objectStore: () => ({
        get: (key) => {
          const request = { result: data.get(key) ?? undefined, error: null, onsuccess: null };
          // Вызов onsuccess для get через промис (не setTimeout — безопаснее для тестов)
          Promise.resolve().then(() => { if (request.onsuccess) request.onsuccess(); });
          return request;
        },
        put: (value, key) => {
          if (!shouldFail) data.set(key, value);
          return { result: key, error: null };
        },
        delete: (key) => {
          data.delete(key);
          return { result: undefined, error: null };
        },
      }),
      oncomplete: null,
      onerror: null,
      error: null,
    };

    // Завершение транзакции через setTimeout (даёт время тесту навесить .catch)
    setTimeout(() => {
      if (shouldFail) {
        tx.error = new DOMException('QuotaExceededError', 'QuotaExceededError');
        if (tx.onerror) tx.onerror();
      } else {
        if (tx.oncomplete) tx.oncomplete();
      }
    }, 0);

    return tx;
  };

  const mockDb = {
    transaction: createTransaction,
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore: (name) => { createStore(name); },
    close: vi.fn(),
    onclose: null,
    onversionchange: null,
  };

  const mockOpen = vi.fn(() => {
    const req = {
      result: mockDb,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    setTimeout(() => {
      if (req.onupgradeneeded) req.onupgradeneeded();
      if (req.onsuccess) req.onsuccess();
    }, 0);
    return req;
  });

  return {
    open: mockOpen,
    _stores: stores,
    _mockDb: mockDb,
    _setFailOnPut: (val) => { _failOnPut = val; },
  };
}

describe('IdbStorage Quota & Migration', () => {
  let storage;
  let mockIdb;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockIdb = createMockIndexedDB();
    global.indexedDB = mockIdb;
  });

  afterEach(() => {
    storage?.destroy();
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete global.indexedDB;
  });

  // ═══════════════════════════════════════════
  // БАЗОВЫЕ ОПЕРАЦИИ
  // ═══════════════════════════════════════════

  describe('Basic CRUD operations', () => {
    it('should put and get values', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const putPromise = storage.put('key1', { data: 'hello' });
      await vi.advanceTimersByTimeAsync(10);
      await putPromise;

      const getPromise = storage.get('key1');
      await vi.advanceTimersByTimeAsync(10);
      const result = await getPromise;

      expect(result).toEqual({ data: 'hello' });
    });

    it('should return null for non-existent keys', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const getPromise = storage.get('nonexistent');
      await vi.advanceTimersByTimeAsync(10);
      const result = await getPromise;

      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const putPromise = storage.put('key1', 'value1');
      await vi.advanceTimersByTimeAsync(10);
      await putPromise;

      const delPromise = storage.delete('key1');
      await vi.advanceTimersByTimeAsync(10);
      await delPromise;

      const getPromise = storage.get('key1');
      await vi.advanceTimersByTimeAsync(10);
      const result = await getPromise;

      expect(result).toBeNull();
    });

    it('should overwrite existing values', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const put1 = storage.put('key1', 'first');
      await vi.advanceTimersByTimeAsync(10);
      await put1;

      const put2 = storage.put('key1', 'second');
      await vi.advanceTimersByTimeAsync(10);
      await put2;

      const getPromise = storage.get('key1');
      await vi.advanceTimersByTimeAsync(10);
      const result = await getPromise;

      expect(result).toBe('second');
    });
  });

  // ═══════════════════════════════════════════
  // QUOTA EXCEEDED
  // ═══════════════════════════════════════════

  describe('Quota exceeded handling', () => {
    it('should reject put when storage quota exceeded', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      // Открываем соединение заранее (до включения fail)
      const warmup = storage.get('_warmup');
      await vi.advanceTimersByTimeAsync(10);
      await warmup;

      mockIdb._setFailOnPut(true);

      const putPromise = storage.put('big-key', 'huge data');
      putPromise.catch(() => {}); // предотвращаем unhandled rejection
      await vi.advanceTimersByTimeAsync(10);
      await flushPromises();

      await expect(putPromise).rejects.toBeDefined();
    });

    it('should still allow get after quota exceeded on put', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      // Сначала записываем успешно
      const putPromise = storage.put('existing', 'value');
      await vi.advanceTimersByTimeAsync(10);
      await putPromise;

      // Включаем fail на put
      mockIdb._setFailOnPut(true);

      const failedPut = storage.put('overflow', 'data');
      failedPut.catch(() => {}); // предотвращаем unhandled rejection
      await vi.advanceTimersByTimeAsync(10);
      await flushPromises();

      // Get по-прежнему работает
      mockIdb._setFailOnPut(false);
      const getPromise = storage.get('existing');
      await vi.advanceTimersByTimeAsync(10);
      await flushPromises();
      const result = await getPromise;

      expect(result).toBe('value');
    });
  });

  // ═══════════════════════════════════════════
  // IDLE TIMEOUT
  // ═══════════════════════════════════════════

  describe('Idle timeout and connection management', () => {
    it('should close connection after idle timeout', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const getPromise = storage.get('key');
      await vi.advanceTimersByTimeAsync(10);
      await getPromise;

      // Соединение открыто — close ещё не вызван
      expect(mockIdb._mockDb.close).not.toHaveBeenCalled();

      // Ждём idle timeout (5000ms)
      await vi.advanceTimersByTimeAsync(5100);

      // Соединение закрыто по idle timeout
      expect(mockIdb._mockDb.close).toHaveBeenCalled();
    });

    it('should reset idle timer on each operation', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const get1 = storage.get('key');
      await vi.advanceTimersByTimeAsync(10);
      await get1;

      // Ждём 3 секунды (не полный idle) — close ещё не вызван
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockIdb._mockDb.close).not.toHaveBeenCalled();

      // Новая операция — сбрасывает таймер
      const get2 = storage.get('key');
      await vi.advanceTimersByTimeAsync(10);
      await get2;

      // Ещё 3 секунды — всего 6 с первой операции, но 3 со второй — close ещё не вызван
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockIdb._mockDb.close).not.toHaveBeenCalled();

      // Полный idle после последней операции — соединение закрыто
      await vi.advanceTimersByTimeAsync(2100);
      expect(mockIdb._mockDb.close).toHaveBeenCalled();
    });

    it('should reopen connection after idle close', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const putPromise = storage.put('persist', 'data');
      await vi.advanceTimersByTimeAsync(10);
      await putPromise;

      // Ждём idle timeout
      await vi.advanceTimersByTimeAsync(5100);
      expect(storage._db).toBeNull();

      // Новая операция — переоткрывает соединение
      const getPromise = storage.get('persist');
      await vi.advanceTimersByTimeAsync(10);
      const result = await getPromise;

      expect(result).toBe('data');
      expect(storage._db).not.toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // CONCURRENT OPERATIONS
  // ═══════════════════════════════════════════

  describe('Concurrent operations', () => {
    it('should handle multiple parallel operations on same connection', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const ops = [
        storage.put('a', 1),
        storage.put('b', 2),
        storage.put('c', 3),
      ];

      await vi.advanceTimersByTimeAsync(10);
      await flushPromises();
      await Promise.all(ops);

      const results = [];
      for (const key of ['a', 'b', 'c']) {
        const p = storage.get(key);
        await vi.advanceTimersByTimeAsync(10);
        await flushPromises();
        results.push(await p);
      }

      expect(results).toEqual([1, 2, 3]);
    });

    it('should reuse same connection for concurrent requests', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const p1 = storage.get('key1');
      const p2 = storage.get('key2');

      await vi.advanceTimersByTimeAsync(10);
      await flushPromises();
      await Promise.all([p1, p2]);

      expect(mockIdb.open).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════
  // CONNECTION RECOVERY
  // ═══════════════════════════════════════════

  describe('Connection recovery', () => {
    it('should handle unexpected connection close', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const getPromise = storage.get('key');
      await vi.advanceTimersByTimeAsync(10);
      await getPromise;

      // Симулируем onclose (browser-initiated close)
      mockIdb._mockDb.onclose();
      expect(storage._db).toBeNull();

      // Следующая операция должна переоткрыть соединение
      const get2 = storage.get('key');
      await vi.advanceTimersByTimeAsync(10);
      await get2;

      expect(mockIdb.open).toHaveBeenCalledTimes(2);
    });

    it('should handle versionchange event', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const getPromise = storage.get('key');
      await vi.advanceTimersByTimeAsync(10);
      await getPromise;

      // Симулируем versionchange (другая вкладка обновляет DB)
      mockIdb._mockDb.onversionchange();

      expect(mockIdb._mockDb.close).toHaveBeenCalled();
      expect(storage._db).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // OPEN ERRORS
  // ═══════════════════════════════════════════

  describe('Open errors', () => {
    it('should reject operations when indexedDB.open fails', async () => {
      const failingIdb = {
        open: vi.fn(() => {
          const req = { result: null, error: new Error('Blocked'), onsuccess: null, onerror: null, onupgradeneeded: null };
          setTimeout(() => { if (req.onerror) req.onerror(); }, 0);
          return req;
        }),
      };
      global.indexedDB = failingIdb;

      storage = new IdbStorage('test-db', 'test-store');

      const getPromise = storage.get('key');
      getPromise.catch(() => {}); // предотвращаем unhandled rejection
      await vi.advanceTimersByTimeAsync(10);

      await expect(getPromise).rejects.toBeDefined();
    });
  });

  // ═══════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════

  describe('Destroy', () => {
    it('should close connection and clear idle timer on destroy', async () => {
      storage = new IdbStorage('test-db', 'test-store');

      const getPromise = storage.get('key');
      await vi.advanceTimersByTimeAsync(10);
      await getPromise;

      // Соединение открыто до destroy
      expect(mockIdb._mockDb.close).not.toHaveBeenCalled();

      storage.destroy();

      // Соединение немедленно закрыто
      expect(mockIdb._mockDb.close).toHaveBeenCalled();

      // Idle timeout не срабатывает после destroy (close не вызывается повторно)
      const closeCallsAfterDestroy = mockIdb._mockDb.close.mock.calls.length;
      await vi.advanceTimersByTimeAsync(6000);
      expect(mockIdb._mockDb.close).toHaveBeenCalledTimes(closeCallsAfterDestroy);
    });

    it('should be safe to call destroy multiple times', () => {
      storage = new IdbStorage('test-db', 'test-store');
      storage.destroy();
      expect(() => storage.destroy()).not.toThrow();
    });

    it('should be safe to destroy without opening connection', () => {
      storage = new IdbStorage('test-db', 'test-store');
      expect(() => storage.destroy()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════
  // МИГРАЦИЯ localStorage → IndexedDB
  // ═══════════════════════════════════════════

  describe('localStorage → IndexedDB migration pattern', () => {
    it('should migrate data from localStorage to IdbStorage', async () => {
      const legacyData = {
        'font-data-custom1': 'data:font/woff2;base64,ABC',
        'font-data-custom2': 'data:font/woff2;base64,DEF',
        'ambient-data-rain': 'data:audio/mp3;base64,GHI',
      };

      Object.entries(legacyData).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });

      storage = new IdbStorage('migration-db', 'binary-data');

      for (const key of Object.keys(legacyData)) {
        const value = localStorage.getItem(key);
        if (value) {
          const putPromise = storage.put(key, value);
          await vi.advanceTimersByTimeAsync(10);
          await flushPromises();
          await putPromise;
          localStorage.removeItem(key);
        }
      }

      // Проверяем что данные в IDB
      for (const key of Object.keys(legacyData)) {
        const getPromise = storage.get(key);
        await vi.advanceTimersByTimeAsync(10);
        await flushPromises();
        const result = await getPromise;
        expect(result).toBe(legacyData[key]);
      }

      // localStorage очищен
      for (const key of Object.keys(legacyData)) {
        expect(localStorage.getItem(key)).toBeNull();
      }
    });

    it('should handle migration failure gracefully (keep localStorage data)', async () => {
      localStorage.setItem('font-data-important', 'data:font/woff2;base64,KEEP');

      mockIdb._setFailOnPut(true);
      storage = new IdbStorage('migration-db', 'binary-data');

      const value = localStorage.getItem('font-data-important');

      try {
        const putPromise = storage.put('font-data-important', value);
        putPromise.catch(() => {}); // предотвращаем unhandled rejection
        await vi.advanceTimersByTimeAsync(10);
        await flushPromises();
        await putPromise;
        localStorage.removeItem('font-data-important');
      } catch {
        // Миграция не удалась — оставляем данные в localStorage
      }

      expect(localStorage.getItem('font-data-important')).toBe('data:font/woff2;base64,KEEP');
    });
  });
});
