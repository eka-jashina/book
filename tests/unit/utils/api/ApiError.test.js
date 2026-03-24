/**
 * TESTS: ApiError
 * Тесты для структурированной ошибки HTTP-запроса
 */

import { describe, it, expect } from 'vitest';
import { ApiError } from '@utils/api/ApiError.js';

describe('ApiError', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // КОНСТРУКТОР
  // ═══════════════════════════════════════════════════════════════════════════

  it('должен создать экземпляр Error', () => {
    const error = new ApiError(404, 'Not found');
    expect(error).toBeInstanceOf(Error);
  });

  it('должен установить name = "ApiError"', () => {
    const error = new ApiError(500, 'Server error');
    expect(error.name).toBe('ApiError');
  });

  it('должен сохранить status', () => {
    const error = new ApiError(403, 'Forbidden');
    expect(error.status).toBe(403);
  });

  it('должен сохранить message', () => {
    const error = new ApiError(400, 'Bad request');
    expect(error.message).toBe('Bad request');
  });

  it('должен сохранить details', () => {
    const details = { field: 'email', code: 'invalid' };
    const error = new ApiError(422, 'Validation failed', details);
    expect(error.details).toEqual(details);
  });

  it('должен установить details = null по умолчанию', () => {
    const error = new ApiError(500, 'Error');
    expect(error.details).toBeNull();
  });

  it('должен иметь stack trace', () => {
    const error = new ApiError(500, 'Error');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ApiError');
  });

  it('должен работать с status = 0 (network error)', () => {
    const error = new ApiError(0, 'Network error');
    expect(error.status).toBe(0);
    expect(error.message).toBe('Network error');
  });
});
