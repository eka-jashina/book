/**
 * TESTS: IdbStorage
 * Тесты для обёртки над IndexedDB: CRUD, пул соединений,
 * idle таймаут, обработка ошибок, destroy.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IdbStorage } from '../../../js/utils/IdbStorage.js';

/**
 * Создать мок IndexedDB со всеми необходимыми объектами.
 * @param {Object} [opts] - Опции для настройки поведения мока
 * @param {boolean} [opts.openFails] - Симулировать ошибку открытия
 * @param {boolean} [opts.txFails] - Симулировать ошибку транзакции
 * @param {boolean} [opts.needsUpgrade] - Симулировать первое открытие (onupgradeneeded)
 */
function createIDBMock(opts = {}) {
  const data = {};

  const mockObjectStore = {
    get: vi.fn((key) => {
      const request = {
        result: data[key] ?? undefined,
        onsuccess: null,
        onerror: null,
      };
      setTimeout(() => request.onsuccess?.({ target: request }));
      return request;
    }),
    put: vi.fn((value, key) => {
      data[key] = structuredClone(value);
      const request = { onsuccess: null, onerror: null };
      setTimeout(() => request.onsuccess?.({ target: request }));
      return request;
    }),
    delete: vi.fn((key) => {
      delete data[key];
      const request = { onsuccess: null, onerror: null };
      setTimeout(() => request.onsuccess?.({ target: request }));
      return request;
    }),
  };

  const mockTransaction = {
    objectStore: vi.fn(() => mockObjectStore),
    oncomplete: null,
    onerror: null,
    error: null,
  };

  // Auto-trigger oncomplete/onerror
  const origObjectStore = mockTransaction.objectStore;
  mockTransaction.objectStore = vi.fn((...args) => {
    const result = origObjectStore(...args);
    if (opts.txFails) {
      mockTransaction.error = new DOMException('Transaction failed');
      setTimeout(() => mockTransaction.onerror?.({ target: mockTransaction }));
    } else {
      setTimeout(() => mockTransaction.oncomplete?.());
    }
    return result;
  });

  const mockDB = {
    transaction: vi.fn(() => mockTransaction),
    objectStoreNames: {
      contains: vi.fn(() => !opts.needsUpgrade),
    },
    createObjectStore: vi.fn(),
    close: vi.fn(),
    onclose: null,
    onversionchange: null,
  };

  const mockRequest = {
    result: mockDB,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
    error: null,
  };

  return {
    indexedDB: {
      open: vi.fn(() => {
        if (opts.openFails) {
          mockRequest.error = new DOMException('IDB open failed');
          setTimeout(() => mockRequest.onerror?.({ target: mockRequest }));
        } else {
          // Trigger onupgradeneeded first if needed
          if (opts.needsUpgrade) {
            setTimeout(() => {
              mockRequest.onupgradeneeded?.({ target: mockRequest });
              mockRequest.onsuccess?.({ target: mockRequest });
            });
          } else {
            setTimeout(() => mockRequest.onsuccess?.({ target: mockRequest }));
          }
        }
        return mockRequest;
      }),
    },
    _data: data,
    _mockDB: mockDB,
    _mockTransaction: mockTransaction,
    _mockObjectStore: mockObjectStore,
    _mockRequest: mockRequest,
  };
}

describe('IdbStorage', () => {
  let idb;
  let mock;

  beforeEach(() => {
    vi.useFakeTimers();
    mock = createIDBMock();
    global.indexedDB = mock.indexedDB;
  });

  afterEach(() => {
    idb?.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize with provided params', () => {
      idb = new IdbStorage('test-db', 'test-store', 2);
      expect(idb._dbName).toBe('test-db');
      expect(idb._storeName).toBe('test-store');
      expect(idb._version).toBe(2);
      expect(idb._db).toBeNull();
      expect(idb._opening).toBeNull();
      expect(idb._idleTimer).toBeNull();
    });

    it('should default version to 1', () => {
      idb = new IdbStorage('test-db', 'test-store');
      expect(idb._version).toBe(1);
    });
  });

  // ═══════════════════════════════════════════
  // GET
  // ═══════════════════════════════════════════

  describe('get()', () => {
    it('should return null when key not found', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const getPromise = idb.get('nonexistent');
      await vi.advanceTimersByTimeAsync(100);
      const result = await getPromise;

      expect(result).toBeNull();
    });

    it('should return stored value', async () => {
      mock._data['my-key'] = { foo: 'bar' };
      idb = new IdbStorage('test-db', 'test-store');

      const getPromise = idb.get('my-key');
      await vi.advanceTimersByTimeAsync(100);
      const result = await getPromise;

      expect(result).toEqual({ foo: 'bar' });
    });

    it('should open connection on first get', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const getPromise = idb.get('key');
      await vi.advanceTimersByTimeAsync(100);
      await getPromise;

      expect(mock.indexedDB.open).toHaveBeenCalledWith('test-db', 1);
    });
  });

  // ═══════════════════════════════════════════
  // PUT
  // ═══════════════════════════════════════════

  describe('put()', () => {
    it('should store value by key', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const putPromise = idb.put('my-key', { value: 42 });
      await vi.advanceTimersByTimeAsync(100);
      await putPromise;

      expect(mock._data['my-key']).toEqual({ value: 42 });
    });

    it('should overwrite existing value', async () => {
      mock._data['key'] = { old: true };
      idb = new IdbStorage('test-db', 'test-store');

      const putPromise = idb.put('key', { new: true });
      await vi.advanceTimersByTimeAsync(100);
      await putPromise;

      expect(mock._data['key']).toEqual({ new: true });
    });

    it('should use readwrite transaction', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const putPromise = idb.put('key', 'val');
      await vi.advanceTimersByTimeAsync(100);
      await putPromise;

      expect(mock._mockDB.transaction).toHaveBeenCalledWith('test-store', 'readwrite');
    });
  });

  // ═══════════════════════════════════════════
  // DELETE
  // ═══════════════════════════════════════════

  describe('delete()', () => {
    it('should delete value by key', async () => {
      mock._data['key'] = 'value';
      idb = new IdbStorage('test-db', 'test-store');

      const deletePromise = idb.delete('key');
      await vi.advanceTimersByTimeAsync(100);
      await deletePromise;

      expect(mock._data['key']).toBeUndefined();
    });

    it('should use readwrite transaction', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const delPromise = idb.delete('key');
      await vi.advanceTimersByTimeAsync(100);
      await delPromise;

      expect(mock._mockDB.transaction).toHaveBeenCalledWith('test-store', 'readwrite');
    });
  });

  // ═══════════════════════════════════════════
  // CONNECTION POOLING
  // ═══════════════════════════════════════════

  describe('connection pooling', () => {
    it('should reuse existing connection for sequential operations', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const p1 = idb.get('key1');
      await vi.advanceTimersByTimeAsync(100);
      await p1;

      const p2 = idb.get('key2');
      await vi.advanceTimersByTimeAsync(100);
      await p2;

      // indexedDB.open should be called only once
      expect(mock.indexedDB.open).toHaveBeenCalledTimes(1);
    });

    it('should queue concurrent opens and resolve all with same connection', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      // Start two operations before connection is established
      const p1 = idb.get('key1');
      const p2 = idb.get('key2');
      await vi.advanceTimersByTimeAsync(100);
      await Promise.all([p1, p2]);

      // Only one open call
      expect(mock.indexedDB.open).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════
  // IDLE TIMEOUT
  // ═══════════════════════════════════════════

  describe('idle timeout', () => {
    it('should close connection after 5 seconds of inactivity', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const p = idb.get('key');
      await vi.advanceTimersByTimeAsync(100);
      await p;

      expect(idb._db).not.toBeNull();

      // Advance past idle timeout (5000ms)
      await vi.advanceTimersByTimeAsync(5000);

      expect(mock._mockDB.close).toHaveBeenCalled();
      expect(idb._db).toBeNull();
    });

    it('should reset idle timer on each operation', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const p1 = idb.get('key1');
      await vi.advanceTimersByTimeAsync(100);
      await p1;

      // Wait 3 seconds (less than timeout)
      await vi.advanceTimersByTimeAsync(3000);

      // Another operation should reset timer
      const p2 = idb.get('key2');
      await vi.advanceTimersByTimeAsync(100);
      await p2;

      // Wait 3 more seconds — should NOT close (timer was reset)
      await vi.advanceTimersByTimeAsync(3000);
      expect(idb._db).not.toBeNull();

      // Wait full 5s from last operation — should close
      await vi.advanceTimersByTimeAsync(2000);
      expect(mock._mockDB.close).toHaveBeenCalled();
    });

    it('should reopen connection after idle close', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const p1 = idb.put('key', 'val');
      await vi.advanceTimersByTimeAsync(100);
      await p1;

      // Wait for idle close
      await vi.advanceTimersByTimeAsync(5000);
      expect(idb._db).toBeNull();

      // New operation should reopen
      const p2 = idb.get('key');
      await vi.advanceTimersByTimeAsync(100);
      await p2;

      expect(mock.indexedDB.open).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════
  // VERSIONCHANGE & ONCLOSE
  // ═══════════════════════════════════════════

  describe('versionchange and onclose events', () => {
    it('should handle onversionchange by closing and clearing cache', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const p = idb.get('key');
      await vi.advanceTimersByTimeAsync(100);
      await p;

      expect(idb._db).not.toBeNull();

      // Simulate versionchange event
      mock._mockDB.onversionchange?.();

      expect(mock._mockDB.close).toHaveBeenCalled();
      expect(idb._db).toBeNull();
    });

    it('should handle onclose by clearing cache', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const p = idb.get('key');
      await vi.advanceTimersByTimeAsync(100);
      await p;

      // Simulate unexpected close
      mock._mockDB.onclose?.();

      expect(idb._db).toBeNull();
    });
  });

  // ═══════════════════════════════════════════
  // OBJECT STORE CREATION
  // ═══════════════════════════════════════════

  describe('object store creation', () => {
    it('should create object store on first open if missing', async () => {
      const upgradeMock = createIDBMock({ needsUpgrade: true });
      global.indexedDB = upgradeMock.indexedDB;

      idb = new IdbStorage('test-db', 'test-store');

      const p = idb.get('key');
      await vi.advanceTimersByTimeAsync(100);
      await p;

      expect(upgradeMock._mockDB.createObjectStore).toHaveBeenCalledWith('test-store');
    });

    it('should not create object store if already exists', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const p = idb.get('key');
      await vi.advanceTimersByTimeAsync(100);
      await p;

      expect(mock._mockDB.createObjectStore).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════

  describe('error handling', () => {
    it('should reject when open fails', async () => {
      vi.useRealTimers();
      const failMock = createIDBMock({ openFails: true });
      global.indexedDB = failMock.indexedDB;

      idb = new IdbStorage('test-db', 'test-store');

      await expect(idb.get('key')).rejects.toThrow();
      vi.useFakeTimers();
    });

    it('should clear _opening on error', async () => {
      vi.useRealTimers();
      const failMock = createIDBMock({ openFails: true });
      global.indexedDB = failMock.indexedDB;

      idb = new IdbStorage('test-db', 'test-store');

      try { await idb.get('key'); } catch { /* expected */ }

      expect(idb._opening).toBeNull();
      vi.useFakeTimers();
    });

    it('should reject when transaction errors', async () => {
      vi.useRealTimers();
      const failMock = createIDBMock({ txFails: true });
      global.indexedDB = failMock.indexedDB;

      idb = new IdbStorage('test-db', 'test-store');

      await expect(idb.put('key', 'val')).rejects.toThrow();
      vi.useFakeTimers();
    });
  });

  // ═══════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════

  describe('destroy()', () => {
    it('should close connection on destroy', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const p = idb.get('key');
      await vi.advanceTimersByTimeAsync(100);
      await p;

      idb.destroy();

      expect(mock._mockDB.close).toHaveBeenCalled();
      expect(idb._db).toBeNull();
      expect(idb._idleTimer).toBeNull();
    });

    it('should handle destroy when no connection is open', () => {
      idb = new IdbStorage('test-db', 'test-store');

      // Should not throw
      expect(() => idb.destroy()).not.toThrow();
    });

    it('should clear idle timer on destroy', async () => {
      idb = new IdbStorage('test-db', 'test-store');

      const p = idb.get('key');
      await vi.advanceTimersByTimeAsync(100);
      await p;

      expect(idb._idleTimer).not.toBeNull();

      idb.destroy();

      expect(idb._idleTimer).toBeNull();
    });
  });
});
