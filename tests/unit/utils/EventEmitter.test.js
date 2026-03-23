/**
 * TESTS: EventEmitter
 * Тесты для реализации паттерна Observer/PubSub
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from '@utils/EventEmitter.js';

describe('EventEmitter', () => {
  let emitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBSCRIBE & EMIT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('on() and emit()', () => {
    it('should call handler when event is emitted', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.emit('test');

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should pass single argument to handler', () => {
      const handler = vi.fn();
      emitter.on('data', handler);
      emitter.emit('data', 'argument');

      expect(handler).toHaveBeenCalledWith('argument');
    });

    it('should pass multiple arguments to handler', () => {
      const handler = vi.fn();
      emitter.on('data', handler);
      emitter.emit('data', 'arg1', 42, { key: 'value' });

      expect(handler).toHaveBeenCalledWith('arg1', 42, { key: 'value' });
    });

    it('should support multiple handlers for same event', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on('test', handler1);
      emitter.on('test', handler2);
      emitter.on('test', handler3);
      emitter.emit('test');

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      expect(handler3).toHaveBeenCalledOnce();
    });

    it('should call handlers in subscription order', () => {
      const order = [];
      emitter.on('test', () => order.push(1));
      emitter.on('test', () => order.push(2));
      emitter.on('test', () => order.push(3));
      emitter.emit('test');

      expect(order).toEqual([1, 2, 3]);
    });

    it('should not call handlers for different events', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('event1', handler1);
      emitter.on('event2', handler2);
      emitter.emit('event1');

      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle emit with no subscribers gracefully', () => {
      expect(() => emitter.emit('unknown')).not.toThrow();
    });

    it('should handle emit with no arguments', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.emit('test');

      expect(handler).toHaveBeenCalledWith();
    });

    it('should allow same handler for multiple events', () => {
      const handler = vi.fn();
      emitter.on('event1', handler);
      emitter.on('event2', handler);

      emitter.emit('event1');
      emitter.emit('event2');

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // UNSUBSCRIBE
  // ═══════════════════════════════════════════════════════════════════════════

  describe('unsubscribe', () => {
    it('should return unsubscribe function from on()', () => {
      const handler = vi.fn();
      const unsubscribe = emitter.on('test', handler);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
      emitter.emit('test');

      expect(handler).not.toHaveBeenCalled();
    });

    it('should remove specific handler with off()', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('test', handler1);
      emitter.on('test', handler2);
      emitter.off('test', handler1);
      emitter.emit('test');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledOnce();
    });

    it('should handle off() for non-existent handler gracefully', () => {
      const handler = vi.fn();
      expect(() => emitter.off('test', handler)).not.toThrow();
    });

    it('should handle off() for non-existent event gracefully', () => {
      expect(() => emitter.off('unknown', vi.fn())).not.toThrow();
    });

    it('should allow re-subscription after unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = emitter.on('test', handler);

      unsubscribe();
      emitter.on('test', handler);
      emitter.emit('test');

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should handle double unsubscribe gracefully', () => {
      const handler = vi.fn();
      const unsubscribe = emitter.on('test', handler);

      unsubscribe();
      expect(() => unsubscribe()).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('error handling', () => {
    it('should continue calling handlers if one throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const normalHandler = vi.fn();

      emitter.on('test', errorHandler);
      emitter.on('test', normalHandler);

      // Подавляем вывод в консоль для чистоты теста
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      emitter.emit('test');

      expect(errorHandler).toHaveBeenCalled();
      expect(normalHandler).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should log error when handler throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const errorHandler = () => {
        throw new Error('test error');
      };

      emitter.on('test', errorHandler);
      emitter.emit('test');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('EventEmitter error'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should include event name in error message', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      emitter.on('myEvent', () => {
        throw new Error('fail');
      });
      emitter.emit('myEvent');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('myEvent'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should call onError callback when handler throws', () => {
      const onError = vi.fn();
      const emitterWithCallback = new EventEmitter({ onError });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('handler failed');
      emitterWithCallback.on('test', () => { throw error; });
      emitterWithCallback.emit('test');

      expect(onError).toHaveBeenCalledWith(error, 'test');
      consoleSpy.mockRestore();
    });

    it('should pass event name to onError callback', () => {
      const onError = vi.fn();
      const emitterWithCallback = new EventEmitter({ onError });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      emitterWithCallback.on('myEvent', () => { throw new Error('fail'); });
      emitterWithCallback.emit('myEvent');

      expect(onError).toHaveBeenCalledWith(expect.any(Error), 'myEvent');
      consoleSpy.mockRestore();
    });

    it('should not call onError when no handler throws', () => {
      const onError = vi.fn();
      const emitterWithCallback = new EventEmitter({ onError });

      emitterWithCallback.on('test', () => {});
      emitterWithCallback.emit('test');

      expect(onError).not.toHaveBeenCalled();
    });

    it('should work without onError option (backward compatibility)', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const plainEmitter = new EventEmitter();

      plainEmitter.on('test', () => { throw new Error('fail'); });
      expect(() => plainEmitter.emit('test')).not.toThrow();

      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // DESTROY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('destroy()', () => {
    it('should remove all listeners for all events', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on('event1', handler1);
      emitter.on('event2', handler2);
      emitter.on('event1', handler3);

      emitter.destroy();

      emitter.emit('event1');
      emitter.emit('event2');

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should allow new subscriptions after destroy', () => {
      emitter.on('test', vi.fn());
      emitter.destroy();

      const newHandler = vi.fn();
      emitter.on('test', newHandler);
      emitter.emit('test');

      expect(newHandler).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle empty string as event name', () => {
      const handler = vi.fn();
      emitter.on('', handler);
      emitter.emit('');

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should handle special characters in event name', () => {
      const handler = vi.fn();
      emitter.on('event:with:colons', handler);
      emitter.emit('event:with:colons');

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should handle numeric event name', () => {
      const handler = vi.fn();
      emitter.on(123, handler);
      emitter.emit(123);

      expect(handler).toHaveBeenCalledOnce();
    });

    it('should handle undefined and null as event arguments', () => {
      const handler = vi.fn();
      emitter.on('test', handler);
      emitter.emit('test', undefined, null);

      expect(handler).toHaveBeenCalledWith(undefined, null);
    });

    it('should handle handler that modifies emitter during emit', () => {
      const handler1 = vi.fn(() => {
        emitter.on('test', handler3);
      });
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on('test', handler1);
      emitter.on('test', handler2);
      emitter.emit('test');

      // handler3 не должен быть вызван в этом emit
      expect(handler1).toHaveBeenCalledOnce();
      expect(handler2).toHaveBeenCalledOnce();
      // handler3 добавлен, но вызывается только при следующем emit
    });
  });
});
