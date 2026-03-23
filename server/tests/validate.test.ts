import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, validateQuery } from '../src/middleware/validate.js';

function createMockReqRes(body?: unknown, query?: unknown) {
  const req = {
    body: body ?? {},
    query: query ?? {},
  } as unknown as Request;

  const res = { locals: {} } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

describe('validate middleware', () => {
  const schema = z.object({
    title: z.string().min(1),
    page: z.number().int().positive(),
  });

  it('should pass valid body and call next()', () => {
    const { req, res, next } = createMockReqRes({ title: 'Hello', page: 5 });
    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ title: 'Hello', page: 5 });
  });

  it('should strip unknown fields from body', () => {
    const { req, res, next } = createMockReqRes({ title: 'Hi', page: 1, extra: true });
    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ title: 'Hi', page: 1 });
    expect(req.body).not.toHaveProperty('extra');
  });

  it('should call next(err) on invalid body', () => {
    const { req, res, next } = createMockReqRes({ title: '', page: -1 });
    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
  });

  it('should call next(err) when body is missing required fields', () => {
    const { req, res, next } = createMockReqRes({});
    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
  });

  it('should call next(err) when body has wrong types', () => {
    const { req, res, next } = createMockReqRes({ title: 123, page: 'abc' });
    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
  });
});

describe('validateQuery middleware', () => {
  const querySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });

  it('should pass valid query and call next()', () => {
    const { req, res, next } = createMockReqRes(undefined, { page: '2', limit: '50' });
    validateQuery(querySchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.locals.query).toEqual({ page: 2, limit: 50 });
  });

  it('should apply defaults for missing query params', () => {
    const { req, res, next } = createMockReqRes(undefined, {});
    validateQuery(querySchema)(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.locals.query).toEqual({ page: 1, limit: 20 });
  });

  it('should call next(err) on invalid query', () => {
    const { req, res, next } = createMockReqRes(undefined, { page: 'abc', limit: '200' });
    validateQuery(querySchema)(req, res, next);

    // 'abc' coerces to NaN which fails positive(), or limit > 100
    expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
  });
});
