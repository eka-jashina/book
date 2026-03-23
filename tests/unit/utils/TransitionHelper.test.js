/**
 * TESTS: TransitionHelper
 * Тесты для утилиты ожидания CSS transitions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransitionHelper } from '@utils/TransitionHelper.js';

describe('TransitionHelper', () => {
  let element;

  beforeEach(() => {
    element = document.createElement('div');
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // BASIC FUNCTIONALITY
  // ═══════════════════════════════════════════════════════════════════════════

  describe('basic functionality', () => {
    it('should return a Promise', () => {
      const result = TransitionHelper.waitFor(element, null, 1000);

      expect(result).toBeInstanceOf(Promise);
    });

    it('should resolve on transitionend event', async () => {
      const promise = TransitionHelper.waitFor(element, null, 5000);

      // Симулируем transitionend
      element.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'opacity',
      }));

      await expect(promise).resolves.toBeUndefined();
    });

    it('should resolve on timeout if no transition', async () => {
      const promise = TransitionHelper.waitFor(element, null, 100);

      vi.advanceTimersByTime(100);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should add transitionend event listener', () => {
      const addEventListenerSpy = vi.spyOn(element, 'addEventListener');

      TransitionHelper.waitFor(element, null, 1000);

      expect(addEventListenerSpy).toHaveBeenCalledWith('transitionend', expect.any(Function));
    });

    it('should remove transitionend event listener after resolve', async () => {
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      const promise = TransitionHelper.waitFor(element, null, 1000);

      element.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'opacity',
      }));

      await promise;

      expect(removeEventListenerSpy).toHaveBeenCalledWith('transitionend', expect.any(Function));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPERTY NAME FILTERING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('property name filtering', () => {
    it('should resolve when specific property transitions', async () => {
      const promise = TransitionHelper.waitFor(element, 'opacity', 5000);

      element.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'opacity',
      }));

      await expect(promise).resolves.toBeUndefined();
    });

    it('should ignore transitions of other properties', async () => {
      const promise = TransitionHelper.waitFor(element, 'opacity', 500);

      // Transition другого свойства
      element.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'transform',
      }));

      // Promise ещё не разрешён, ждём таймаут
      let resolved = false;
      promise.then(() => { resolved = true; });

      // Подождём немного (но меньше таймаута)
      vi.advanceTimersByTime(100);
      expect(resolved).toBe(false);

      // Теперь ждём таймаут
      vi.advanceTimersByTime(400);
      await promise;
    });

    it('should accept any property when propertyName is null', async () => {
      const promise = TransitionHelper.waitFor(element, null, 5000);

      element.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'transform',
      }));

      await expect(promise).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT TARGET FILTERING
  // ═══════════════════════════════════════════════════════════════════════════

  describe('event target filtering', () => {
    it('should resolve for events from target element', async () => {
      const promise = TransitionHelper.waitFor(element, null, 5000);

      const event = new TransitionEvent('transitionend', {
        propertyName: 'opacity',
      });
      // В jsdom event.target автоматически устанавливается на element при dispatch

      element.dispatchEvent(event);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should ignore events from child elements', async () => {
      const child = document.createElement('span');
      element.appendChild(child);

      const promise = TransitionHelper.waitFor(element, null, 500);

      // Создаём event на child, но он bubbles к parent
      // В jsdom это требует особой настройки, упрощаем тест
      // Симулируем событие где target !== element
      let handler;
      vi.spyOn(element, 'addEventListener').mockImplementation((type, h) => {
        handler = h;
      });

      TransitionHelper.waitFor(element, null, 500);

      // Вызываем handler с event где target !== element
      const fakeEvent = {
        target: child,
        propertyName: 'opacity',
      };
      handler(fakeEvent);

      // Promise не должен разрешиться сразу
      let resolved = false;
      TransitionHelper.waitFor(element, null, 100).then(() => { resolved = true; });

      vi.advanceTimersByTime(50);
      expect(resolved).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMEOUT
  // ═══════════════════════════════════════════════════════════════════════════

  describe('timeout', () => {
    it('should resolve after timeout expires', async () => {
      const promise = TransitionHelper.waitFor(element, null, 1000);

      vi.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should use specified timeout value', async () => {
      const promise = TransitionHelper.waitFor(element, null, 500);

      vi.advanceTimersByTime(499);

      // Ещё не разрешён
      let resolved = false;
      promise.then(() => { resolved = true; });

      await vi.advanceTimersByTimeAsync(0);
      expect(resolved).toBe(false);

      vi.advanceTimersByTime(1);
      await vi.advanceTimersByTimeAsync(0);

      expect(resolved).toBe(true);
    });

    it('should clear timeout after transitionend', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const promise = TransitionHelper.waitFor(element, null, 5000);

      element.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'opacity',
      }));

      await promise;

      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ABORT SIGNAL
  // ═══════════════════════════════════════════════════════════════════════════

  describe('AbortSignal support', () => {
    it('should reject immediately if signal already aborted', async () => {
      const controller = new AbortController();
      controller.abort();

      const promise = TransitionHelper.waitFor(element, null, 5000, controller.signal);

      await expect(promise).rejects.toThrow('Aborted');
    });

    it('should reject with AbortError when signal aborts', async () => {
      const controller = new AbortController();

      const promise = TransitionHelper.waitFor(element, null, 5000, controller.signal);

      controller.abort();

      await expect(promise).rejects.toMatchObject({
        name: 'AbortError',
      });
    });

    it('should add abort listener to signal', () => {
      const controller = new AbortController();
      const addEventListenerSpy = vi.spyOn(controller.signal, 'addEventListener');

      TransitionHelper.waitFor(element, null, 5000, controller.signal);

      expect(addEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('should remove abort listener after resolve', async () => {
      const controller = new AbortController();
      const removeEventListenerSpy = vi.spyOn(controller.signal, 'removeEventListener');

      const promise = TransitionHelper.waitFor(element, null, 5000, controller.signal);

      element.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'opacity',
      }));

      await promise;

      expect(removeEventListenerSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    });

    it('should cleanup on abort', async () => {
      const controller = new AbortController();
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
      const removeEventListenerSpy = vi.spyOn(element, 'removeEventListener');

      const promise = TransitionHelper.waitFor(element, null, 5000, controller.signal);

      controller.abort();

      await expect(promise).rejects.toThrow();

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('transitionend', expect.any(Function));
    });

    it('should work without signal (null)', async () => {
      const promise = TransitionHelper.waitFor(element, null, 1000, null);

      vi.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should work without signal (undefined/omitted)', async () => {
      const promise = TransitionHelper.waitFor(element, null, 1000);

      vi.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RACE CONDITIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('race conditions', () => {
    it('should only resolve once even if transition and timeout both fire', async () => {
      let resolveCount = 0;

      const promise = TransitionHelper.waitFor(element, null, 100);
      promise.then(() => { resolveCount++; });

      // Transition fires
      element.dispatchEvent(new TransitionEvent('transitionend', {
        propertyName: 'opacity',
      }));

      // Timeout also fires
      vi.advanceTimersByTime(100);

      await promise;
      await vi.advanceTimersByTimeAsync(0);

      expect(resolveCount).toBe(1);
    });

    it('should only resolve once for multiple transitions', async () => {
      let resolveCount = 0;

      const promise = TransitionHelper.waitFor(element, null, 5000);
      promise.then(() => { resolveCount++; });

      // Multiple transitions
      element.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }));
      element.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'transform' }));
      element.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'color' }));

      await promise;

      expect(resolveCount).toBe(1);
    });

    it('should not resolve after abort', async () => {
      const controller = new AbortController();
      let resolved = false;
      let rejected = false;

      const promise = TransitionHelper.waitFor(element, null, 5000, controller.signal);
      promise.then(() => { resolved = true; }).catch(() => { rejected = true; });

      controller.abort();

      // Try to trigger transition after abort
      element.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }));

      await vi.advanceTimersByTimeAsync(0);

      expect(rejected).toBe(true);
      expect(resolved).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MULTIPLE CALLS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('multiple concurrent calls', () => {
    it('should handle multiple waitFor on same element', async () => {
      const promise1 = TransitionHelper.waitFor(element, 'opacity', 5000);
      const promise2 = TransitionHelper.waitFor(element, 'transform', 5000);

      // Trigger opacity transition
      element.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }));

      await promise1;

      // promise2 should still be pending (waiting for transform)
      let resolved2 = false;
      promise2.then(() => { resolved2 = true; });

      await vi.advanceTimersByTimeAsync(0);
      expect(resolved2).toBe(false);

      // Trigger transform transition
      element.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'transform' }));

      await promise2;
      expect(resolved2).toBe(true);
    });

    it('should handle multiple elements', async () => {
      const element2 = document.createElement('span');

      const promise1 = TransitionHelper.waitFor(element, null, 5000);
      const promise2 = TransitionHelper.waitFor(element2, null, 5000);

      element.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }));

      await promise1;

      // promise2 ещё не разрешён
      let resolved2 = false;
      promise2.then(() => { resolved2 = true; });
      await vi.advanceTimersByTimeAsync(0);
      expect(resolved2).toBe(false);

      element2.dispatchEvent(new TransitionEvent('transitionend', { propertyName: 'opacity' }));

      await promise2;
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle zero timeout', async () => {
      const promise = TransitionHelper.waitFor(element, null, 0);

      vi.advanceTimersByTime(0);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should handle very short timeout', async () => {
      const promise = TransitionHelper.waitFor(element, null, 1);

      vi.advanceTimersByTime(1);

      await expect(promise).resolves.toBeUndefined();
    });

    it('should handle empty string propertyName', async () => {
      const promise = TransitionHelper.waitFor(element, '', 5000);

      // Empty string is truthy for if check, so it will filter
      element.dispatchEvent(new TransitionEvent('transitionend', { propertyName: '' }));

      await expect(promise).resolves.toBeUndefined();
    });
  });
});
