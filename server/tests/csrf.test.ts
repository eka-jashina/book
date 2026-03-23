import { describe, it, expect, vi, beforeEach } from 'vitest';
import { doubleCsrfProtection, generateCsrfToken } from '../src/middleware/csrf.js';

describe('CSRF Middleware', () => {
  it('doubleCsrfProtection should be a function', () => {
    expect(typeof doubleCsrfProtection).toBe('function');
  });

  it('generateCsrfToken should be a function', () => {
    expect(typeof generateCsrfToken).toBe('function');
  });

  it('doubleCsrfProtection should have middleware signature (3 params)', () => {
    // Express middleware: (req, res, next)
    expect(doubleCsrfProtection.length).toBe(3);
  });

  it('generateCsrfToken should accept req and res parameters', () => {
    // (req, res) => string
    expect(generateCsrfToken.length).toBe(2);
  });
});
