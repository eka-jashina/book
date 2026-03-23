/**
 * TESTS: MediaQueryManager
 * Тесты для реактивного отслеживания media queries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MediaQueryManager, mediaQueries } from '@utils/MediaQueryManager.js';

describe('MediaQueryManager', () => {
  let manager;

  beforeEach(() => {
    manager = new MediaQueryManager();
  });

  afterEach(() => {
    manager.destroy();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize with empty queries map', () => {
      expect(manager._queries.size).toBe(0);
    });

    it('should initialize with empty listeners set', () => {
      expect(manager._listeners.size).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // register()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('register()', () => {
    it('should register media query by name', () => {
      manager.register('mobile', '(max-width: 768px)');

      expect(manager._queries.has('mobile')).toBe(true);
    });

    it('should store MediaQueryList object', () => {
      manager.register('tablet', '(max-width: 1024px)');

      const mql = manager._queries.get('tablet');
      expect(mql).toBeDefined();
      expect(typeof mql.matches).toBe('boolean');
    });

    it('should return unsubscribe function', () => {
      const unsubscribe = manager.register('desktop', '(min-width: 1025px)');

      expect(typeof unsubscribe).toBe('function');
    });

    it('should register multiple queries', () => {
      manager.register('mobile', '(max-width: 768px)');
      manager.register('tablet', '(max-width: 1024px)');
      manager.register('desktop', '(min-width: 1025px)');

      expect(manager._queries.size).toBe(3);
    });

    it('should override query with same name', () => {
      manager.register('mobile', '(max-width: 768px)');
      manager.register('mobile', '(max-width: 480px)');

      expect(manager._queries.size).toBe(1);
    });

    it('should add change event listener to media query', () => {
      const addEventListenerSpy = vi.fn();
      const mockMql = {
        matches: false,
        addEventListener: addEventListenerSpy,
        removeEventListener: vi.fn(),
      };
      vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql);

      manager.register('test', '(max-width: 500px)');

      expect(addEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));

      vi.mocked(window.matchMedia).mockRestore();
    });

    it('should remove event listener when unsubscribe called', () => {
      const removeEventListenerSpy = vi.fn();
      const mockMql = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: removeEventListenerSpy,
      };
      vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql);

      const unsubscribe = manager.register('test', '(max-width: 500px)');
      unsubscribe();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('change', expect.any(Function));

      vi.mocked(window.matchMedia).mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // get()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('get()', () => {
    it('should return false for unregistered query', () => {
      expect(manager.get('nonexistent')).toBe(false);
    });

    it('should return matches value for registered query', () => {
      const mockMql = {
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql);

      manager.register('mobile', '(max-width: 768px)');

      expect(manager.get('mobile')).toBe(true);

      vi.mocked(window.matchMedia).mockRestore();
    });

    it('should return false when query does not match', () => {
      const mockMql = {
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };
      vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql);

      manager.register('desktop', '(min-width: 1025px)');

      expect(manager.get('desktop')).toBe(false);

      vi.mocked(window.matchMedia).mockRestore();
    });

    it('should return current state of media query', () => {
      // Используем реальный matchMedia из setup.js
      manager.register('wide', '(min-width: 1200px)');

      // По умолчанию matchMedia mock возвращает matches: false
      expect(typeof manager.get('wide')).toBe('boolean');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // subscribe()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('subscribe()', () => {
    it('should add listener to set', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      expect(manager._listeners.size).toBe(1);
    });

    it('should return unsubscribe function', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should remove listener when unsubscribe called', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      expect(manager._listeners.size).toBe(1);

      unsubscribe();

      expect(manager._listeners.size).toBe(0);
    });

    it('should support multiple subscribers', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      const listener3 = vi.fn();

      manager.subscribe(listener1);
      manager.subscribe(listener2);
      manager.subscribe(listener3);

      expect(manager._listeners.size).toBe(3);
    });

    it('should not add same listener twice', () => {
      const listener = vi.fn();

      manager.subscribe(listener);
      manager.subscribe(listener);

      // Set не добавляет дубликаты
      expect(manager._listeners.size).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _notifyListeners()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_notifyListeners()', () => {
    it('should call all subscribed listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.subscribe(listener1);
      manager.subscribe(listener2);

      manager._notifyListeners();

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).toHaveBeenCalledOnce();
    });

    it('should not call unsubscribed listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      manager.subscribe(listener1);
      const unsubscribe = manager.subscribe(listener2);
      unsubscribe();

      manager._notifyListeners();

      expect(listener1).toHaveBeenCalledOnce();
      expect(listener2).not.toHaveBeenCalled();
    });

    it('should catch errors from listeners', () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      manager.subscribe(errorListener);
      manager.subscribe(normalListener);

      // Не должен выбрасывать исключение
      expect(() => manager._notifyListeners()).not.toThrow();

      // Остальные listeners всё равно вызваны
      expect(normalListener).toHaveBeenCalledOnce();

      // Ошибка залогирована
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'MediaQueryManager listener error:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('should call listeners without arguments', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager._notifyListeners();

      expect(listener).toHaveBeenCalledWith();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // destroy()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should clear all queries', () => {
      manager.register('mobile', '(max-width: 768px)');
      manager.register('tablet', '(max-width: 1024px)');

      manager.destroy();

      expect(manager._queries.size).toBe(0);
    });

    it('should clear all listeners', () => {
      manager.subscribe(vi.fn());
      manager.subscribe(vi.fn());

      manager.destroy();

      expect(manager._listeners.size).toBe(0);
    });

    it('should be safe to call multiple times', () => {
      manager.register('test', '(max-width: 500px)');
      manager.subscribe(vi.fn());

      expect(() => {
        manager.destroy();
        manager.destroy();
      }).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MEDIA QUERY CHANGE EVENTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('media query change events', () => {
    it('should notify listeners when media query changes', () => {
      let changeHandler;
      const mockMql = {
        matches: false,
        addEventListener: (event, handler) => {
          changeHandler = handler;
        },
        removeEventListener: vi.fn(),
      };
      vi.spyOn(window, 'matchMedia').mockReturnValue(mockMql);

      const listener = vi.fn();
      manager.subscribe(listener);
      manager.register('mobile', '(max-width: 768px)');

      // Симулируем изменение media query
      changeHandler();

      expect(listener).toHaveBeenCalledOnce();

      vi.mocked(window.matchMedia).mockRestore();
    });

    it('should notify all listeners on any query change', () => {
      let changeHandler1;
      let changeHandler2;
      let callCount = 0;

      vi.spyOn(window, 'matchMedia').mockImplementation(() => {
        callCount++;
        const handler = { current: null };
        return {
          matches: false,
          addEventListener: (event, h) => {
            if (callCount === 1) changeHandler1 = h;
            else changeHandler2 = h;
          },
          removeEventListener: vi.fn(),
        };
      });

      const listener = vi.fn();
      manager.subscribe(listener);
      manager.register('mobile', '(max-width: 768px)');
      manager.register('tablet', '(max-width: 1024px)');

      // Изменение первого query
      changeHandler1();
      expect(listener).toHaveBeenCalledTimes(1);

      // Изменение второго query
      changeHandler2();
      expect(listener).toHaveBeenCalledTimes(2);

      vi.mocked(window.matchMedia).mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SINGLETON EXPORT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('mediaQueries singleton', () => {
    it('should be instance of MediaQueryManager', () => {
      expect(mediaQueries).toBeInstanceOf(MediaQueryManager);
    });

    it('should have mobile query pre-registered', () => {
      expect(mediaQueries._queries.has('mobile')).toBe(true);
    });

    it('should return boolean for mobile query', () => {
      expect(typeof mediaQueries.get('mobile')).toBe('boolean');
    });
  });
});
