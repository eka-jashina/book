import { getPrisma } from './prisma.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Verify that a book exists and belongs to the specified user.
 * Throws 404 if not found, 403 if access denied.
 */
export async function verifyBookOwnership(
  bookId: string,
  userId: string,
): Promise<void> {
  const prisma = getPrisma();
  const book = await prisma.book.findFirst({
    where: { id: bookId, deletedAt: null },
    select: { userId: true },
  });

  if (!book) throw new AppError(404, 'Book not found');
  if (book.userId !== userId) throw new AppError(403, 'Access denied');
}
