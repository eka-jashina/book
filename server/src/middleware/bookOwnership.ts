import type { Request, Response, NextFunction } from 'express';
import { verifyBookOwnership } from '../utils/ownership.js';

/**
 * Middleware that verifies the authenticated user owns the book specified by :bookId.
 * Must be used after requireAuth middleware.
 */
export async function requireBookOwnership(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const bookId = req.params.bookId as string;
    const userId = req.user!.id;
    await verifyBookOwnership(bookId, userId);
    next();
  } catch (err) {
    next(err);
  }
}
