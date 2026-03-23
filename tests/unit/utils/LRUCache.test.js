/**
 * TESTS: LRUCache
 * Тесты для LRU-кэша страниц
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LRUCache } from '@utils/LRUCache.js';

describe('LRUCache', () => {
  let cache;

  beforeEach(() => {
    cache = new LRUCache(3);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('missing')).toBeNull();
    });

    it('should track size correctly', () => {
      expect(cache.size).toBe(0);
      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.size).toBe(2);
    });

    it('should check existence with has() without changing order', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      // has() не должен менять порядок
      expect(cache.has('a')).toBe(true);
      expect(cache.has('z')).toBe(false);

      // Добавляем 'd' - должен вытесниться 'a' (самый старый)
      cache.set('d', 4);
      expect(cache.has('a')).toBe(false);
    });

    it('should update value for existing key', () => {
      cache.set('key', 'old');
      cache.set('key', 'new');
      expect(cache.get('key')).toBe('new');
      expect(cache.size).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // LRU EVICTION
  // ═══════════════════════════════════════════════════════════════════════════

  describe('LRU eviction', () => {
    it('should evict least recently used when limit exceeded', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // Вытесняет 'a'

      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(true);
      expect(cache.has('c')).toBe(true);
      expect(cache.has('d')).toBe(true);
      expect(cache.size).toBe(3);
    });

    it('should update access order on get()', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.get('a'); // Перемещаем 'a' в конец
      cache.set('d', 4); // Вытесняет 'b' (теперь самый старый)

      expect(cache.has('a')).toBe(true);
      expect(cache.has('b')).toBe(false);
    });

    it('should update access order on set() for existing key', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      cache.set('a', 10); // Обновляем 'a' - перемещается в конец
      cache.set('d', 4); // Вытесняет 'b'

      expect(cache.get('a')).toBe(10);
      expect(cache.has('b')).toBe(false);
    });

    it('should handle multiple evictions correctly', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);
      cache.set('d', 4); // evicts 'a'
      cache.set('e', 5); // evicts 'b'
      cache.set('f', 6); // evicts 'c'

      expect(cache.has('a')).toBe(false);
      expect(cache.has('b')).toBe(false);
      expect(cache.has('c')).toBe(false);
      expect(cache.has('d')).toBe(true);
      expect(cache.has('e')).toBe(true);
      expect(cache.has('f')).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clear()', () => {
    it('should remove all entries', () => {
      cache.set('a', 1);
      cache.set('b', 2);
      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.has('a')).toBe(false);
      expect(cache.get('a')).toBeNull();
    });

    it('should allow adding new entries after clear', () => {
      cache.set('a', 1);
      cache.clear();
      cache.set('b', 2);

      expect(cache.size).toBe(1);
      expect(cache.get('b')).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should work with limit of 1', () => {
      const tinyCache = new LRUCache(1);
      tinyCache.set('a', 1);
      tinyCache.set('b', 2);

      expect(tinyCache.has('a')).toBe(false);
      expect(tinyCache.get('b')).toBe(2);
      expect(tinyCache.size).toBe(1);
    });

    it('should handle various value types', () => {
      // Используем кэш с бОльшим лимитом для этого теста
      const largeCache = new LRUCache(10);

      largeCache.set('obj', { foo: 'bar' });
      largeCache.set('arr', [1, 2, 3]);
      largeCache.set('num', 42);
      largeCache.set('str', 'hello');

      expect(largeCache.get('obj')).toEqual({ foo: 'bar' });
      expect(largeCache.get('arr')).toEqual([1, 2, 3]);
      expect(largeCache.get('num')).toBe(42);
      expect(largeCache.get('str')).toBe('hello');
    });

    it('should handle numeric keys', () => {
      cache.set(1, 'one');
      cache.set(2, 'two');

      expect(cache.get(1)).toBe('one');
      expect(cache.get(2)).toBe('two');
    });

    it('should handle empty string as key', () => {
      cache.set('', 'empty');
      expect(cache.get('')).toBe('empty');
    });
  });
});
