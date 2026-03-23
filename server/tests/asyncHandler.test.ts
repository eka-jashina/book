import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../src/utils/asyncHandler.js';

function createMockReqRes() {
  const req = {} as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

describe('asyncHandler', () => {
  it('should call the wrapped async function', async () => {
    const handler = vi.fn(async () => {});
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMockReqRes();

    wrapped(req, res, next);

    // Wait for the promise microtask
    await vi.waitFor(() => {
      expect(handler).toHaveBeenCalledWith(req, res, next);
    });
  });

  it('should call next(err) when async function rejects', async () => {
    const error = new Error('async failure');
    const handler = vi.fn(async () => {
      throw error;
    });
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMockReqRes();

    wrapped(req, res, next);

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  it('should not call next(err) when async function resolves', async () => {
    const handler = vi.fn(async (_req: Request, res: Response) => {
      res.json({ ok: true });
    });
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMockReqRes();

    wrapped(req, res, next);

    await vi.waitFor(() => {
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return void (not a promise) from wrapper', () => {
    const handler = vi.fn(async () => {});
    const wrapped = asyncHandler(handler);
    const { req, res, next } = createMockReqRes();

    const result = wrapped(req, res, next);
    expect(result).toBeUndefined();
  });
});
