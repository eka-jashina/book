import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import multer from 'multer';
import { errorHandler, AppError } from '../src/middleware/errorHandler.js';

function createMockReqRes(overrides?: Partial<Request>) {
  const req = {
    method: 'GET',
    originalUrl: '/api/v1/test',
    ip: '127.0.0.1',
    id: 'test-request-id',
    user: undefined,
    ...overrides,
  } as unknown as Request;

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;

  const next = vi.fn() as NextFunction;

  return { req, res, next };
}

describe('Error Handler Middleware', () => {
  // ── AppError ─────────────────────────────────────────────────

  describe('AppError', () => {
    it('should handle AppError with status code and message', () => {
      const { req, res, next } = createMockReqRes();
      const err = new AppError(404, 'Not found');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'AppError',
          message: 'Not found',
          statusCode: 404,
          requestId: 'test-request-id',
        }),
      );
    });

    it('should use custom code when provided', () => {
      const { req, res, next } = createMockReqRes();
      const err = new AppError(400, 'Bad input', 'INVALID_INPUT');

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'INVALID_INPUT',
          message: 'Bad input',
          statusCode: 400,
        }),
      );
    });

    it('should include details when provided', () => {
      const { req, res, next } = createMockReqRes();
      const details = { field: 'email', reason: 'already exists' };
      const err = new AppError(409, 'Conflict', 'DUPLICATE', details);

      errorHandler(err, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: { field: 'email', reason: 'already exists' },
        }),
      );
    });

    it('should not include requestId if not present', () => {
      const { req, res, next } = createMockReqRes();
      (req as any).id = undefined;
      const err = new AppError(400, 'Bad');

      errorHandler(err, req, res, next);

      const jsonArg = (res.json as any).mock.calls[0][0];
      expect(jsonArg).not.toHaveProperty('requestId');
    });
  });

  // ── ZodError ─────────────────────────────────────────────────

  describe('ZodError', () => {
    it('should handle ZodError as 400', () => {
      const { req, res, next } = createMockReqRes();
      const err = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['title'],
          message: 'Expected string, received number',
        },
      ]);

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ValidationError',
          message: 'Invalid request data',
          statusCode: 400,
          details: expect.arrayContaining([
            expect.objectContaining({ path: ['title'] }),
          ]),
        }),
      );
    });
  });

  // ── MulterError ──────────────────────────────────────────────

  describe('MulterError', () => {
    it('should handle LIMIT_FILE_SIZE as 413', () => {
      const { req, res, next } = createMockReqRes();
      const err = new multer.MulterError('LIMIT_FILE_SIZE');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UploadError',
          statusCode: 413,
        }),
      );
    });

    it('should handle other MulterError codes as 400', () => {
      const { req, res, next } = createMockReqRes();
      const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'UploadError',
          statusCode: 400,
        }),
      );
    });
  });

  // ── Prisma Errors ────────────────────────────────────────────

  describe('Prisma errors', () => {
    it('should handle P2002 (unique constraint) as 409', () => {
      const { req, res, next } = createMockReqRes();
      const err = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['email'] },
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ConflictError',
          statusCode: 409,
        }),
      );
    });

    it('should handle P2025 (not found) as 404', () => {
      const { req, res, next } = createMockReqRes();
      const err = new Prisma.PrismaClientKnownRequestError('Record not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'NotFoundError',
          statusCode: 404,
        }),
      );
    });

    it('should handle P2003 (foreign key violation) as 409', () => {
      const { req, res, next } = createMockReqRes();
      const err = new Prisma.PrismaClientKnownRequestError('FK violation', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ConflictError',
          statusCode: 409,
        }),
      );
    });

    it('should handle unknown Prisma error codes as 500', () => {
      const { req, res, next } = createMockReqRes();
      const err = new Prisma.PrismaClientKnownRequestError('Unknown error', {
        code: 'P2010',
        clientVersion: '5.0.0',
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'DatabaseError',
          statusCode: 500,
        }),
      );
    });
  });

  // ── HTTP-errors style (statusCode property) ──────────────────

  describe('HTTP-errors style errors', () => {
    it('should handle errors with statusCode property', () => {
      const { req, res, next } = createMockReqRes();
      const err = Object.assign(new Error('Forbidden'), {
        statusCode: 403,
        name: 'ForbiddenError',
      });

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'ForbiddenError',
          message: 'Forbidden',
          statusCode: 403,
        }),
      );
    });
  });

  // ── Generic/unhandled errors ─────────────────────────────────

  describe('Unhandled errors', () => {
    it('should return 500 for generic errors', () => {
      const { req, res, next } = createMockReqRes();
      const err = new Error('Something broke');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'InternalServerError',
          message: 'An unexpected error occurred',
          statusCode: 500,
        }),
      );
    });

    it('should not expose internal error details', () => {
      const { req, res, next } = createMockReqRes();
      const err = new Error('Database connection string leaked');

      errorHandler(err, req, res, next);

      const jsonArg = (res.json as any).mock.calls[0][0];
      expect(jsonArg.message).toBe('An unexpected error occurred');
      expect(jsonArg.message).not.toContain('Database connection');
    });
  });
});
