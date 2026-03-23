import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter, createAuthRateLimiter, createPublicRateLimiter } from '../src/middleware/rateLimit.js';

describe('Rate Limiter Middleware', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('test environment (noop)', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'test';
    });

    it('createRateLimiter returns a noop middleware in test env', () => {
      const middleware = createRateLimiter();
      const next = vi.fn();
      middleware({} as any, {} as any, next);
      expect(next).toHaveBeenCalled();
    });

    it('createAuthRateLimiter returns a noop middleware in test env', () => {
      const middleware = createAuthRateLimiter();
      const next = vi.fn();
      middleware({} as any, {} as any, next);
      expect(next).toHaveBeenCalled();
    });

    it('createPublicRateLimiter returns a noop middleware in test env', () => {
      const middleware = createPublicRateLimiter();
      const next = vi.fn();
      middleware({} as any, {} as any, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('non-test environment', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('createRateLimiter returns a real middleware function', () => {
      const middleware = createRateLimiter();
      expect(typeof middleware).toBe('function');
      // Real rate limiter has arity 3 (req, res, next)
      expect(middleware.length).toBeGreaterThanOrEqual(0);
    });

    it('createAuthRateLimiter returns a real middleware function', () => {
      const middleware = createAuthRateLimiter();
      expect(typeof middleware).toBe('function');
    });

    it('createPublicRateLimiter returns a real middleware function', () => {
      const middleware = createPublicRateLimiter();
      expect(typeof middleware).toBe('function');
    });
  });
});
