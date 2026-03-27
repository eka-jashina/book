import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter, rateLimiters } from '../../../js/utils/RateLimiter.js';

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter({
      maxTokens: 5,
      refillRate: 2,
      minInterval: 100,
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const defaultLimiter = new RateLimiter();
      expect(defaultLimiter.maxTokens).toBe(10);
      expect(defaultLimiter.refillRate).toBe(2);
      expect(defaultLimiter.minInterval).toBe(100);
    });

    it('should accept custom options', () => {
      expect(limiter.maxTokens).toBe(5);
      expect(limiter.refillRate).toBe(2);
      expect(limiter.minInterval).toBe(100);
    });
  });

  describe('tryAction', () => {
    it('should allow actions within token limit', () => {
      expect(limiter.tryAction()).toBe(true);
      vi.advanceTimersByTime(110);
      expect(limiter.tryAction()).toBe(true);
      vi.advanceTimersByTime(110);
      expect(limiter.tryAction()).toBe(true);
    });

    it('should block actions when tokens exhausted', () => {
      // refillRate=0.01 — практически без восстановления, minInterval=1ms
      const fastLimiter = new RateLimiter({ maxTokens: 3, refillRate: 0.01, minInterval: 1 });

      expect(fastLimiter.tryAction()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(fastLimiter.tryAction()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(fastLimiter.tryAction()).toBe(true);
      vi.advanceTimersByTime(1);

      // Токены исчерпаны
      expect(fastLimiter.tryAction()).toBe(false);
    });

    it('should block actions that are too frequent', () => {
      expect(limiter.tryAction()).toBe(true);
      // Немедленное повторное действие — блокируется по minInterval
      expect(limiter.tryAction()).toBe(false);
    });

    it('should allow actions after minInterval', () => {
      expect(limiter.tryAction()).toBe(true);

      vi.advanceTimersByTime(110);

      expect(limiter.tryAction()).toBe(true);
    });

    it('should refill tokens over time', () => {
      // Расходуем все токены
      for (let i = 0; i < 5; i++) {
        limiter.tryAction();
        vi.advanceTimersByTime(110);
      }

      // Ждём восстановления (600ms × 2 tokens/sec = ~1.2 токена)
      vi.advanceTimersByTime(600);

      expect(limiter.tryAction()).toBe(true);
    });

    it('should warn after multiple blocked actions', () => {
      // Первое действие успешно, далее 5 подряд заблокированных
      limiter.tryAction();
      for (let i = 0; i < 5; i++) {
        limiter.tryAction();
      }

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('подозрительная активность')
      );
    });

    it('should not warn before reaching warning threshold', () => {
      limiter.tryAction();
      for (let i = 0; i < 4; i++) {
        limiter.tryAction();
      }

      expect(console.warn).not.toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('should return current state', () => {
      const state = limiter.getState();

      expect(state).toHaveProperty('tokens');
      expect(state).toHaveProperty('maxTokens', 5);
      expect(state).toHaveProperty('blockedCount', 0);
      expect(state).toHaveProperty('canAct', true);
    });

    it('should reflect token consumption', () => {
      limiter.tryAction();

      const state = limiter.getState();
      expect(state.tokens).toBeLessThan(5);
    });

    it('should reflect blocked state', () => {
      // Вызываем tryAction дважды подряд — второй будет заблокирован по minInterval
      limiter.tryAction();
      limiter.tryAction();

      const state = limiter.getState();
      expect(state.blockedCount).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should restore tokens to maximum', () => {
      // Расходуем токены
      for (let i = 0; i < 5; i++) {
        limiter.tryAction();
        vi.advanceTimersByTime(100);
      }

      limiter.reset();

      const state = limiter.getState();
      expect(state.tokens).toBe(5);
      expect(state.blockedCount).toBe(0);
    });

    it('should allow actions after reset', () => {
      const strictLimiter = new RateLimiter({ maxTokens: 3, refillRate: 0.01, minInterval: 1 });

      for (let i = 0; i < 3; i++) {
        strictLimiter.tryAction();
        vi.advanceTimersByTime(1);
      }
      expect(strictLimiter.tryAction()).toBe(false);

      strictLimiter.reset();

      expect(strictLimiter.tryAction()).toBe(true);
    });
  });

  describe('rateLimiters presets', () => {
    it('should export all preset limiters', () => {
      expect(rateLimiters.navigation).toBeInstanceOf(RateLimiter);
      expect(rateLimiters.chapter).toBeInstanceOf(RateLimiter);
      expect(rateLimiters.settings).toBeInstanceOf(RateLimiter);
    });

    it('should have chapter limiter stricter than navigation', () => {
      expect(rateLimiters.chapter.maxTokens).toBeLessThan(rateLimiters.navigation.maxTokens);
      expect(rateLimiters.chapter.minInterval).toBeGreaterThan(rateLimiters.navigation.minInterval);
    });
  });
});
