import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RateLimiter, rateLimiters } from '../../../js/utils/RateLimiter.js';

describe('RateLimiter', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({
      maxTokens: 5,
      refillRate: 2,
      minInterval: 100,
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
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
    it('should allow actions within token limit', async () => {
      expect(limiter.tryAction()).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 110));
      expect(limiter.tryAction()).toBe(true);
      await new Promise(resolve => setTimeout(resolve, 110));
      expect(limiter.tryAction()).toBe(true);
    });

    it('should block actions when tokens exhausted', () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.tryAction();
      }
      // Next action should be blocked
      expect(limiter.tryAction()).toBe(false);
    });

    it('should block actions that are too frequent', () => {
      expect(limiter.tryAction()).toBe(true);
      // Immediate second action should be blocked
      expect(limiter.tryAction()).toBe(false);
    });

    it('should allow actions after minInterval', async () => {
      expect(limiter.tryAction()).toBe(true);

      // Wait for minInterval
      await new Promise(resolve => setTimeout(resolve, 110));

      expect(limiter.tryAction()).toBe(true);
    });

    it('should refill tokens over time', async () => {
      // Exhaust all tokens
      for (let i = 0; i < 5; i++) {
        limiter.tryAction();
        await new Promise(resolve => setTimeout(resolve, 110));
      }

      // Wait for tokens to refill (0.5 seconds = 1 token at rate 2/sec)
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(limiter.tryAction()).toBe(true);
    });

    it('should warn after multiple blocked actions', () => {
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        limiter.tryAction();
      }

      // Block 5 more actions to trigger warning
      for (let i = 0; i < 5; i++) {
        limiter.tryAction();
      }

      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('подозрительная активность')
      );
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
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        limiter.tryAction();
      }

      limiter.reset();

      const state = limiter.getState();
      expect(state.tokens).toBe(5);
      expect(state.blockedCount).toBe(0);
    });

    it('should allow actions after reset', () => {
      // Exhaust tokens
      for (let i = 0; i < 5; i++) {
        limiter.tryAction();
      }
      expect(limiter.tryAction()).toBe(false);

      limiter.reset();

      expect(limiter.tryAction()).toBe(true);
    });
  });

  describe('rateLimiters presets', () => {
    it('should have navigation limiter', () => {
      expect(rateLimiters.navigation).toBeInstanceOf(RateLimiter);
      expect(rateLimiters.navigation.maxTokens).toBe(10);
    });

    it('should have chapter limiter with stricter limits', () => {
      expect(rateLimiters.chapter).toBeInstanceOf(RateLimiter);
      expect(rateLimiters.chapter.maxTokens).toBe(3);
      expect(rateLimiters.chapter.minInterval).toBe(500);
    });

    it('should have settings limiter', () => {
      expect(rateLimiters.settings).toBeInstanceOf(RateLimiter);
      expect(rateLimiters.settings.maxTokens).toBe(20);
    });
  });
});
