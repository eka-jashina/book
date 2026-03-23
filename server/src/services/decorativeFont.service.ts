import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { mapDecorativeFontToDto } from '../utils/mappers.js';
import type { DecorativeFontDetail } from '../types/api.js';

export async function getDecorativeFont(bookId: string): Promise<DecorativeFontDetail | null> {

  const prisma = getPrisma();
  const font = await prisma.decorativeFont.findUnique({ where: { bookId } });
  if (!font) return null;
  return mapDecorativeFontToDto(font);
}

export async function upsertDecorativeFont(bookId: string, data: { name: string; fileUrl: string }): Promise<DecorativeFontDetail> {

  const prisma = getPrisma();
  const font = await prisma.decorativeFont.upsert({
    where: { bookId },
    create: { bookId, name: data.name, fileUrl: data.fileUrl },
    update: { name: data.name, fileUrl: data.fileUrl },
  });
  return mapDecorativeFontToDto(font);
}

export async function deleteDecorativeFont(bookId: string): Promise<void> {

  const prisma = getPrisma();
  const font = await prisma.decorativeFont.findUnique({ where: { bookId } });
  if (!font) throw new AppError(404, 'Decorative font not found');
  await prisma.decorativeFont.delete({ where: { bookId } });
  // Best-effort S3 cleanup
  if (font.fileUrl) {
    const { deleteFileByUrl } = await import('../utils/storage.js');
    await deleteFileByUrl(font.fileUrl).catch((err) => {
      logger.warn({ err, fileUrl: font.fileUrl, bookId }, 'Failed to delete decorative font file from S3');
    });
  }
}
