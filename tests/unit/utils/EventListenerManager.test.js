/**
 * TESTS: EventListenerManager
 * Тесты для централизованного управления DOM event listeners
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventListenerManager } from '@utils/EventListenerManager.js';

describe('EventListenerManager', () => {
  let manager;
  let element;

  beforeEach(() => {
    manager = new EventListenerManager();
    element = document.createElement('div');
  });

  afterEach(() => {
    manager.clear();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize with empty listeners map', () => {
      expect(manager.listeners.size).toBe(0);
    });

    it('should initialize with zero listener count', () => {
      expect(manager.listenerCount).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // add()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('add()', () => {
    it('should add event listener to element', () => {
      const handler = vi.fn();
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      manager.add(element, 'click', handler);

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler, {});
    });

    it('should increment listener count', () => {
      manager.add(element, 'click', vi.fn());

      expect(manager.count).toBe(1);
    });

    it('should track element in listeners map', () => {
      manager.add(element, 'click', vi.fn());

      expect(manager.listeners.has(element)).toBe(true);
    });

    it('should track event type for element', () => {
      manager.add(element, 'click', vi.fn());

      const elementListeners = manager.listeners.get(element);
      expect(elementListeners.has('click')).toBe(true);
    });

    it('should handle multiple listeners on same element', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.add(element, 'click', handler1);
      manager.add(element, 'click', handler2);

      expect(manager.count).toBe(2);
    });

    it('should handle different event types on same element', () => {
      manager.add(element, 'click', vi.fn());
      manager.add(element, 'mouseenter', vi.fn());
      manager.add(element, 'mouseleave', vi.fn());

      expect(manager.count).toBe(3);
    });

    it('should handle multiple elements', () => {
      const element2 = document.createElement('button');

      manager.add(element, 'click', vi.fn());
      manager.add(element2, 'click', vi.fn());

      expect(manager.listeners.size).toBe(2);
      expect(manager.count).toBe(2);
    });

    it('should pass options to addEventListener', () => {
      const handler = vi.fn();
      const options = { capture: true, passive: true };
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      manager.add(element, 'scroll', handler, options);

      expect(addEventListenerSpy).toHaveBeenCalledWith('scroll', handler, options);
    });

    it('should handle boolean options', () => {
      const handler = vi.fn();
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      manager.add(element, 'click', handler, true);

      expect(addEventListenerSpy).toHaveBeenCalledWith('click', handler, true);
    });

    it('should ignore null element', () => {
      expect(() => manager.add(null, 'click', vi.fn())).not.toThrow();
      expect(manager.count).toBe(0);
    });

    it('should ignore undefined element', () => {
      expect(() => manager.add(undefined, 'click', vi.fn())).not.toThrow();
      expect(manager.count).toBe(0);
    });

    it('should actually invoke handler on event', () => {
      const handler = vi.fn();
      manager.add(element, 'click', handler);

      element.dispatchEvent(new Event('click'));

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // _createKey()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('_createKey()', () => {
    it('should create key based on capture option', () => {
      const handler = vi.fn();

      const key1 = manager._createKey(handler, { capture: true });
      const key2 = manager._createKey(handler, { capture: false });

      expect(key1).toBe('true|false|false');
      expect(key2).toBe('false|false|false');
    });

    it('should handle boolean options', () => {
      const handler = vi.fn();

      const key1 = manager._createKey(handler, true);
      const key2 = manager._createKey(handler, false);

      expect(key1).toBe('true|false|false');
      expect(key2).toBe('false|false|false');
    });

    it('should default to false capture', () => {
      const handler = vi.fn();

      const key = manager._createKey(handler, {});

      expect(key).toBe('false|false|false');
    });

    it('should differentiate by passive and once options', () => {
      const handler = vi.fn();

      const key1 = manager._createKey(handler, { capture: false, passive: true });
      const key2 = manager._createKey(handler, { capture: false, passive: false });
      const key3 = manager._createKey(handler, { capture: false, once: true });

      expect(key1).toBe('false|true|false');
      expect(key2).toBe('false|false|false');
      expect(key3).toBe('false|false|true');
      expect(key1).not.toBe(key2);
      expect(key2).not.toBe(key3);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // remove()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('remove()', () => {
    it('should remove event listener from element', () => {
      const handler = vi.fn();
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      manager.add(element, 'click', handler);
      manager.remove(element, 'click', handler);

      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', handler, {});
    });

    it('should decrement listener count', () => {
      const handler = vi.fn();
      manager.add(element, 'click', handler);

      expect(manager.count).toBe(1);

      manager.remove(element, 'click', handler);

      expect(manager.count).toBe(0);
    });

    it('should only remove specific listener', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.add(element, 'click', handler1);
      manager.add(element, 'click', handler2);

      manager.remove(element, 'click', handler1);

      expect(manager.count).toBe(1);

      // handler2 still responds to events
      element.dispatchEvent(new Event('click'));
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('should handle remove with matching options', () => {
      const handler = vi.fn();
      const options = { capture: true };

      manager.add(element, 'click', handler, options);
      manager.remove(element, 'click', handler, options);

      expect(manager.count).toBe(0);
    });

    it('should not remove listener with different options', () => {
      const handler = vi.fn();

      manager.add(element, 'click', handler, { capture: true });
      // Попытка удалить с другими options
      manager.remove(element, 'click', handler, { capture: false });

      // Listener ещё активен в tracking (хотя DOM может удалить)
      expect(manager.count).toBe(1);
    });

    it('should ignore null element', () => {
      expect(() => manager.remove(null, 'click', vi.fn())).not.toThrow();
    });

    it('should ignore non-tracked element', () => {
      const untracked = document.createElement('span');

      expect(() => manager.remove(untracked, 'click', vi.fn())).not.toThrow();
    });

    it('should ignore non-tracked event type', () => {
      manager.add(element, 'click', vi.fn());

      expect(() => manager.remove(element, 'mouseenter', vi.fn())).not.toThrow();
    });

    it('should ignore non-tracked handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.add(element, 'click', handler1);

      expect(() => manager.remove(element, 'click', handler2)).not.toThrow();
      expect(manager.count).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // clear()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clear()', () => {
    it('should remove all event listeners', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const element2 = document.createElement('button');

      manager.add(element, 'click', handler1);
      manager.add(element, 'mouseenter', handler2);
      manager.add(element2, 'click', vi.fn());

      manager.clear();

      // События больше не вызывают handlers
      element.dispatchEvent(new Event('click'));
      element.dispatchEvent(new Event('mouseenter'));

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should reset listeners map', () => {
      manager.add(element, 'click', vi.fn());
      manager.add(element, 'mouseenter', vi.fn());

      manager.clear();

      expect(manager.listeners.size).toBe(0);
    });

    it('should reset listener count', () => {
      manager.add(element, 'click', vi.fn());
      manager.add(element, 'mouseenter', vi.fn());
      manager.add(element, 'mouseleave', vi.fn());

      expect(manager.count).toBe(3);

      manager.clear();

      expect(manager.count).toBe(0);
    });

    it('should handle clear on empty manager', () => {
      expect(() => manager.clear()).not.toThrow();
    });

    it('should allow new listeners after clear', () => {
      manager.add(element, 'click', vi.fn());
      manager.clear();

      const newHandler = vi.fn();
      manager.add(element, 'click', newHandler);

      element.dispatchEvent(new Event('click'));

      expect(newHandler).toHaveBeenCalledOnce();
      expect(manager.count).toBe(1);
    });

    it('should remove listeners with various options', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      manager.add(element, 'click', handler1, { capture: true });
      manager.add(element, 'click', handler2, { capture: false });
      manager.add(element, 'scroll', handler3, { passive: true });

      manager.clear();

      expect(manager.count).toBe(0);
      expect(manager.listeners.size).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // count getter
  // ═══════════════════════════════════════════════════════════════════════════

  describe('count getter', () => {
    it('should return 0 for new manager', () => {
      expect(manager.count).toBe(0);
    });

    it('should return correct count after adding', () => {
      manager.add(element, 'click', vi.fn());
      manager.add(element, 'mouseenter', vi.fn());

      expect(manager.count).toBe(2);
    });

    it('should return correct count after removing', () => {
      const handler = vi.fn();
      manager.add(element, 'click', handler);
      manager.add(element, 'mouseenter', vi.fn());

      manager.remove(element, 'click', handler);

      expect(manager.count).toBe(1);
    });

    it('should equal listenerCount property', () => {
      manager.add(element, 'click', vi.fn());
      manager.add(element, 'mouseenter', vi.fn());

      expect(manager.count).toBe(manager.listenerCount);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle same handler added multiple times', () => {
      const handler = vi.fn();

      manager.add(element, 'click', handler);
      manager.add(element, 'click', handler);

      // Оба добавлены в tracking
      expect(manager.count).toBe(2);
    });

    it('should handle window as element', () => {
      const handler = vi.fn();

      manager.add(window, 'resize', handler);

      expect(manager.listeners.has(window)).toBe(true);
      expect(manager.count).toBe(1);
    });

    it('should handle document as element', () => {
      const handler = vi.fn();

      manager.add(document, 'keydown', handler);

      expect(manager.listeners.has(document)).toBe(true);
      expect(manager.count).toBe(1);
    });

    it('should handle multiple managers independently', () => {
      const manager2 = new EventListenerManager();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.add(element, 'click', handler1);
      manager2.add(element, 'click', handler2);

      expect(manager.count).toBe(1);
      expect(manager2.count).toBe(1);

      manager.clear();

      expect(manager.count).toBe(0);
      expect(manager2.count).toBe(1);

      // handler1 удалён, handler2 ещё работает
      element.dispatchEvent(new Event('click'));
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();

      manager2.clear();
    });

    it('should handle capture and bubble for same event', () => {
      const captureHandler = vi.fn();
      const bubbleHandler = vi.fn();

      manager.add(element, 'click', captureHandler, { capture: true });
      manager.add(element, 'click', bubbleHandler, { capture: false });

      expect(manager.count).toBe(2);

      element.dispatchEvent(new Event('click'));

      expect(captureHandler).toHaveBeenCalledOnce();
      expect(bubbleHandler).toHaveBeenCalledOnce();
    });
  });
});
