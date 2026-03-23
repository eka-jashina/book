import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { mapSoundsToDto } from '../utils/mappers.js';
import type { SoundsDetail } from '../types/api.js';

/**
 * Get sounds for a book.
 */
export async function getSounds(
  bookId: string,
): Promise<SoundsDetail> {

  const prisma = getPrisma();
  const sounds = await prisma.bookSounds.findUnique({
    where: { bookId },
  });

  if (!sounds) {
    throw new AppError(404, 'Sounds not found');
  }

  return mapSoundsToDto(sounds);
}

/**
 * Update sounds for a book.
 */
export async function updateSounds(
  bookId: string,
  data: { pageFlip?: string; bookOpen?: string; bookClose?: string },
): Promise<SoundsDetail> {

  const updateData: Record<string, string> = {};
  if (data.pageFlip !== undefined) updateData.pageFlipUrl = data.pageFlip;
  if (data.bookOpen !== undefined) updateData.bookOpenUrl = data.bookOpen;
  if (data.bookClose !== undefined) updateData.bookCloseUrl = data.bookClose;

  const prisma = getPrisma();
  const sounds = await prisma.bookSounds.upsert({
    where: { bookId },
    create: { bookId, ...updateData },
    update: updateData,
  });

  return mapSoundsToDto(sounds);
}
