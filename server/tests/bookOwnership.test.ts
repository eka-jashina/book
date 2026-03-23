import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requireBookOwnership } from '../src/middleware/bookOwnership.js';

vi.mock('../src/utils/ownership.js', () => ({
  verifyBookOwnership: vi.fn(),
}));

import { verifyBookOwnership } from '../src/utils/ownership.js';
const mockedVerify = vi.mocked(verifyBookOwnership);

function createMockReqRes(bookId = 'book-1', userId = 'user-1') {
  const req = {
    params: { bookId },
    user: { id: userId },
  } as unknown as Request;

  const res = {} as Response;
  const next = vi.fn() as unknown as NextFunction;

  return { req, res, next };
}

describe('requireBookOwnership middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call next() when ownership is verified', async () => {
    mockedVerify.mockResolvedValue(undefined);
    const { req, res, next } = createMockReqRes();

    await requireBookOwnership(req, res, next);

    expect(mockedVerify).toHaveBeenCalledWith('book-1', 'user-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('should call next(err) when ownership verification fails', async () => {
    const error = new Error('Access denied');
    mockedVerify.mockRejectedValue(error);
    const { req, res, next } = createMockReqRes();

    await requireBookOwnership(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('should pass correct bookId and userId from request', async () => {
    mockedVerify.mockResolvedValue(undefined);
    const { req, res, next } = createMockReqRes('abc-123', 'usr-456');

    await requireBookOwnership(req, res, next);

    expect(mockedVerify).toHaveBeenCalledWith('abc-123', 'usr-456');
  });
});
