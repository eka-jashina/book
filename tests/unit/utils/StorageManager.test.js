/**
 * TESTS: StorageManager
 * Тесты для абстракции над localStorage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageManager } from '@utils/StorageManager.js';

describe('StorageManager', () => {
  let storage;
  const TEST_KEY = 'test-app-settings';

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageManager(TEST_KEY);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should store the key', () => {
      expect(storage.key).toBe(TEST_KEY);
    });

    it('should work with different keys', () => {
      const storage1 = new StorageManager('key1');
      const storage2 = new StorageManager('key2');

      storage1.save({ a: 1 });
      storage2.save({ b: 2 });

      expect(storage1.load()).toEqual({ a: 1 });
      expect(storage2.load()).toEqual({ b: 2 });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LOAD
  // ═══════════════════════════════════════════════════════════════════════════

  describe('load()', () => {
    it('should return empty object when storage is empty', () => {
      expect(storage.load()).toEqual({});
    });

    it('should return parsed data from localStorage', () => {
      localStorage.setItem(TEST_KEY, JSON.stringify({ font: 'arial', size: 16 }));

      expect(storage.load()).toEqual({ font: 'arial', size: 16 });
    });

    it('should return empty object on JSON parse error', () => {
      localStorage.setItem(TEST_KEY, 'invalid json{{{');
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(storage.load()).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should return empty object when localStorage throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(storage.load()).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();

      getItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('save()', () => {
    it('should save data to localStorage', () => {
      storage.save({ theme: 'dark' });

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ theme: 'dark' });
    });

    it('should overwrite existing fields', () => {
      storage.save({ font: 'georgia' });
      storage.save({ font: 'arial' });

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ font: 'arial' });
    });

    it('should preserve unmodified fields', () => {
      storage.save({ a: 1, b: 2, c: 3 });
      storage.save({ b: 20 });

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ a: 1, b: 20, c: 3 });
    });

    it('should handle empty patch', () => {
      storage.save({ existing: 'value' });
      storage.save({});

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ existing: 'value' });
    });

    it('should handle QuotaExceededError with warning', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw quotaError;
      });

      expect(() => storage.save({ data: 'test' })).not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Storage quota exceeded'),
        TEST_KEY,
      );

      setItemSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should handle other localStorage errors with error log', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => storage.save({ data: 'test' })).not.toThrow();
      expect(errorSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clear()', () => {
    it('should remove data from localStorage', () => {
      storage.save({ foo: 'bar' });
      storage.clear();

      expect(localStorage.getItem(TEST_KEY)).toBeNull();
    });

    it('should return empty object after clear', () => {
      storage.save({ foo: 'bar' });
      storage.clear();

      expect(storage.load()).toEqual({});
    });

    it('should not affect other keys', () => {
      localStorage.setItem('other-key', 'other-value');
      storage.save({ foo: 'bar' });
      storage.clear();

      expect(localStorage.getItem('other-key')).toBe('other-value');
    });

    it('should handle clear on empty storage', () => {
      expect(() => storage.clear()).not.toThrow();
    });

    it('should handle localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const removeItemSpy = vi.spyOn(localStorage, 'removeItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => storage.clear()).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();

      removeItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should allow save after clear', () => {
      storage.save({ before: 'clear' });
      storage.clear();
      storage.save({ after: 'clear' });

      expect(storage.load()).toEqual({ after: 'clear' });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SET FULL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setFull()', () => {
    it('should replace entire value without merge', () => {
      storage.save({ a: 1, b: 2 });
      storage.setFull({ c: 3 });

      const stored = JSON.parse(localStorage.getItem(TEST_KEY));
      expect(stored).toEqual({ c: 3 });
      expect(stored.a).toBeUndefined();
    });

    it('should return true on success', () => {
      expect(storage.setFull({ x: 1 })).toBe(true);
    });

    it('should handle arrays', () => {
      storage.setFull([1, 2, 3]);
      expect(JSON.parse(localStorage.getItem(TEST_KEY))).toEqual([1, 2, 3]);
    });

    it('should handle QuotaExceededError', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      expect(storage.setFull({ data: 'test' })).toBe(false);
      expect(warnSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should handle other errors', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(storage.setFull({ data: 'test' })).toBe(false);
      expect(errorSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET RAW / SET RAW
  // ═══════════════════════════════════════════════════════════════════════════

  describe('getRaw()', () => {
    it('should return null when key not found', () => {
      expect(storage.getRaw()).toBeNull();
    });

    it('should return raw string value', () => {
      localStorage.setItem(TEST_KEY, 'true');
      expect(storage.getRaw()).toBe('true');
    });

    it('should not parse JSON', () => {
      localStorage.setItem(TEST_KEY, '{"a":1}');
      expect(storage.getRaw()).toBe('{"a":1}');
    });

    it('should return null on error', () => {
      const spy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(storage.getRaw()).toBeNull();

      spy.mockRestore();
    });
  });

  describe('setRaw()', () => {
    it('should write raw string value', () => {
      storage.setRaw('1');
      expect(localStorage.getItem(TEST_KEY)).toBe('1');
    });

    it('should return true on success', () => {
      expect(storage.setRaw('hello')).toBe(true);
    });

    it('should overwrite existing value', () => {
      storage.setRaw('old');
      storage.setRaw('new');
      expect(localStorage.getItem(TEST_KEY)).toBe('new');
    });

    it('should return false on QuotaExceeded', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      expect(storage.setRaw('data')).toBe(false);

      setItemSpy.mockRestore();
      warnSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // REMOVE BY PREFIX (static)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('StorageManager.removeByPrefix()', () => {
    it('should remove all keys with prefix', () => {
      localStorage.setItem('reader-settings', 'a');
      localStorage.setItem('reader-settings:book1', 'b');
      localStorage.setItem('reader-settings:book2', 'c');
      localStorage.setItem('other-key', 'd');

      StorageManager.removeByPrefix('reader-settings');

      expect(localStorage.getItem('reader-settings')).toBeNull();
      expect(localStorage.getItem('reader-settings:book1')).toBeNull();
      expect(localStorage.getItem('reader-settings:book2')).toBeNull();
      expect(localStorage.getItem('other-key')).toBe('d');
    });

    it('should handle empty localStorage', () => {
      expect(() => StorageManager.removeByPrefix('any')).not.toThrow();
    });

    it('should handle no matching keys', () => {
      localStorage.setItem('keep-this', 'value');

      StorageManager.removeByPrefix('remove-');

      expect(localStorage.getItem('keep-this')).toBe('value');
    });

    it('should handle localStorage errors gracefully', () => {
      const spy = vi.spyOn(localStorage, 'length', 'get').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      expect(() => StorageManager.removeByPrefix('prefix')).not.toThrow();

      spy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ISOLATION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('isolation between instances', () => {
    it('should allow multiple instances with same key', () => {
      const instance1 = new StorageManager(TEST_KEY);
      const instance2 = new StorageManager(TEST_KEY);

      instance1.save({ value: 1 });
      expect(instance2.load()).toEqual({ value: 1 });

      instance2.save({ value: 2 });
      expect(instance1.load()).toEqual({ value: 2 });
    });
  });
});
