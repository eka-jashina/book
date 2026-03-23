import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Middleware factory that validates request body against a Zod schema.
 * Passes validation errors to the error handler via next(err).
 */
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Middleware factory that validates request query against a Zod schema.
 * Passes validation errors to the error handler via next(err).
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // In Express 5 req.query is read-only (getter).
      // Parse for validation & coercion, store result in res.locals.
      const parsed = schema.parse(req.query);
      _res.locals.query = parsed;
      next();
    } catch (err) {
      next(err);
    }
  };
}
