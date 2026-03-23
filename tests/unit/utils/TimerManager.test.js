/**
 * TESTS: TimerManager
 * Тесты для обёртки над setTimeout и requestAnimationFrame
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TimerManager } from '@utils/TimerManager.js';

describe('TimerManager', () => {
  let manager;

  beforeEach(() => {
    manager = new TimerManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.clear();
    vi.useRealTimers();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONSTRUCTOR
  // ═══════════════════════════════════════════════════════════════════════════

  describe('constructor', () => {
    it('should initialize with empty sets', () => {
      expect(manager.timeouts.size).toBe(0);
      expect(manager.animationFrames.size).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // setTimeout
  // ═══════════════════════════════════════════════════════════════════════════

  describe('setTimeout()', () => {
    it('should call callback after delay', () => {
      const callback = vi.fn();
      manager.setTimeout(callback, 1000);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1000);

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should return timer ID', () => {
      const id = manager.setTimeout(vi.fn(), 1000);
      // С fake timers id может быть объектом Timeout вместо числа
      // Важно что id определён и может быть использован для clearTimeout
      expect(id).toBeDefined();
      expect(id !== null).toBe(true);
    });

    it('should track active timer', () => {
      manager.setTimeout(vi.fn(), 1000);
      expect(manager.timeouts.size).toBe(1);
    });

    it('should track multiple timers', () => {
      manager.setTimeout(vi.fn(), 1000);
      manager.setTimeout(vi.fn(), 2000);
      manager.setTimeout(vi.fn(), 3000);

      expect(manager.timeouts.size).toBe(3);
    });

    it('should remove timer from tracking after execution', () => {
      manager.setTimeout(vi.fn(), 1000);
      expect(manager.timeouts.size).toBe(1);

      vi.advanceTimersByTime(1000);

      expect(manager.timeouts.size).toBe(0);
    });

    it('should handle zero delay', () => {
      const callback = vi.fn();
      manager.setTimeout(callback, 0);

      vi.advanceTimersByTime(0);

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should execute timers in correct order', () => {
      const order = [];
      manager.setTimeout(() => order.push(1), 100);
      manager.setTimeout(() => order.push(2), 200);
      manager.setTimeout(() => order.push(3), 50);

      vi.advanceTimersByTime(200);

      expect(order).toEqual([3, 1, 2]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // clearTimeout
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clearTimeout()', () => {
    it('should cancel timer', () => {
      const callback = vi.fn();
      const id = manager.setTimeout(callback, 1000);

      manager.clearTimeout(id);
      vi.advanceTimersByTime(1000);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove from tracking', () => {
      const id = manager.setTimeout(vi.fn(), 1000);
      expect(manager.timeouts.size).toBe(1);

      manager.clearTimeout(id);
      expect(manager.timeouts.size).toBe(0);
    });

    it('should handle non-existent ID gracefully', () => {
      expect(() => manager.clearTimeout(99999)).not.toThrow();
    });

    it('should only cancel specific timer', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const id1 = manager.setTimeout(cb1, 1000);
      manager.setTimeout(cb2, 1000);

      manager.clearTimeout(id1);
      vi.advanceTimersByTime(1000);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // requestAnimationFrame
  // ═══════════════════════════════════════════════════════════════════════════

  describe('requestAnimationFrame()', () => {
    it('should call callback', () => {
      const callback = vi.fn();
      manager.requestAnimationFrame(callback);

      vi.advanceTimersByTime(16);

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should pass timestamp to callback', () => {
      const callback = vi.fn();
      manager.requestAnimationFrame(callback);

      vi.advanceTimersByTime(16);

      expect(callback).toHaveBeenCalledWith(expect.any(Number));
    });

    it('should return frame ID', () => {
      const id = manager.requestAnimationFrame(vi.fn());
      expect(typeof id).toBe('number');
    });

    it('should track active animation frame', () => {
      manager.requestAnimationFrame(vi.fn());
      expect(manager.animationFrames.size).toBe(1);
    });

    it('should track multiple animation frames', () => {
      manager.requestAnimationFrame(vi.fn());
      manager.requestAnimationFrame(vi.fn());
      manager.requestAnimationFrame(vi.fn());

      expect(manager.animationFrames.size).toBe(3);
    });

    it('should remove from tracking after execution', () => {
      manager.requestAnimationFrame(vi.fn());
      expect(manager.animationFrames.size).toBe(1);

      vi.advanceTimersByTime(16);

      expect(manager.animationFrames.size).toBe(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // cancelAnimationFrame
  // ═══════════════════════════════════════════════════════════════════════════

  describe('cancelAnimationFrame()', () => {
    it('should cancel animation frame', () => {
      const callback = vi.fn();
      const id = manager.requestAnimationFrame(callback);

      manager.cancelAnimationFrame(id);
      vi.advanceTimersByTime(16);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should remove from tracking', () => {
      const id = manager.requestAnimationFrame(vi.fn());
      expect(manager.animationFrames.size).toBe(1);

      manager.cancelAnimationFrame(id);
      expect(manager.animationFrames.size).toBe(0);
    });

    it('should handle non-existent ID gracefully', () => {
      expect(() => manager.cancelAnimationFrame(99999)).not.toThrow();
    });

    it('should only cancel specific frame', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const id1 = manager.requestAnimationFrame(cb1);
      manager.requestAnimationFrame(cb2);

      manager.cancelAnimationFrame(id1);
      vi.advanceTimersByTime(16);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // clear()
  // ═══════════════════════════════════════════════════════════════════════════

  describe('clear()', () => {
    it('should cancel all timers', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      manager.setTimeout(cb1, 1000);
      manager.setTimeout(cb2, 2000);
      manager.setTimeout(cb3, 3000);

      manager.clear();
      vi.advanceTimersByTime(3000);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
      expect(cb3).not.toHaveBeenCalled();
    });

    it('should cancel all animation frames', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      manager.requestAnimationFrame(cb1);
      manager.requestAnimationFrame(cb2);

      manager.clear();
      vi.advanceTimersByTime(16);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });

    it('should cancel mixed timers and animation frames', () => {
      const timeoutCb = vi.fn();
      const rafCb = vi.fn();

      manager.setTimeout(timeoutCb, 1000);
      manager.requestAnimationFrame(rafCb);

      manager.clear();
      vi.advanceTimersByTime(1000);

      expect(timeoutCb).not.toHaveBeenCalled();
      expect(rafCb).not.toHaveBeenCalled();
    });

    it('should reset tracking sets', () => {
      manager.setTimeout(vi.fn(), 1000);
      manager.requestAnimationFrame(vi.fn());

      expect(manager.timeouts.size).toBe(1);
      expect(manager.animationFrames.size).toBe(1);

      manager.clear();

      expect(manager.timeouts.size).toBe(0);
      expect(manager.animationFrames.size).toBe(0);
    });

    it('should handle clear on empty manager', () => {
      expect(() => manager.clear()).not.toThrow();
    });

    it('should allow new timers after clear', () => {
      manager.setTimeout(vi.fn(), 1000);
      manager.clear();

      const newCallback = vi.fn();
      manager.setTimeout(newCallback, 500);

      vi.advanceTimersByTime(500);

      expect(newCallback).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle callback that creates new timer', () => {
      const nestedCallback = vi.fn();
      const outerCallback = vi.fn(() => {
        manager.setTimeout(nestedCallback, 500);
      });

      manager.setTimeout(outerCallback, 100);

      vi.advanceTimersByTime(100);
      expect(outerCallback).toHaveBeenCalledOnce();
      expect(manager.timeouts.size).toBe(1);

      vi.advanceTimersByTime(500);
      expect(nestedCallback).toHaveBeenCalledOnce();
    });

    it('should handle callback that clears itself', () => {
      let timerId;
      const callback = vi.fn(() => {
        manager.clearTimeout(timerId);
      });
      timerId = manager.setTimeout(callback, 100);

      vi.advanceTimersByTime(100);

      // Callback вызван, но clearTimeout на уже сработавший таймер — no-op
      expect(callback).toHaveBeenCalledOnce();
    });

    it('should handle multiple managers independently', () => {
      const manager2 = new TimerManager();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      manager.setTimeout(cb1, 1000);
      manager2.setTimeout(cb2, 1000);

      manager.clear();
      vi.advanceTimersByTime(1000);

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledOnce();

      manager2.clear();
    });
  });
});
