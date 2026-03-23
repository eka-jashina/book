import type { Response } from 'express';

/**
 * Send a 200 JSON response wrapped in the standard envelope.
 *
 * Shape: `{ data, ...meta }`
 */
export function ok<T>(res: Response, data: T, meta?: object): void {
  res.json({ data, ...(meta && { meta }) });
}

/**
 * Send a 201 JSON response wrapped in the standard envelope.
 *
 * Shape: `{ data }`
 */
export function created<T>(res: Response, data: T): void {
  res.status(201).json({ data });
}

/**
 * Send a 204 No Content response (typically for successful DELETE).
 */
export function noContent(res: Response): void {
  res.status(204).send();
}
