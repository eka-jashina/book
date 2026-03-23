import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESOURCE_LIMITS } from '../utils/limits.js';
import { bulkUpdatePositions } from '../utils/reorder.js';
import { withSerializableRetry } from '../utils/serializable.js';
import { logger } from '../utils/logger.js';
import { mapReadingFontToDto } from '../utils/mappers.js';
import type { ReadingFontItem } from '../types/api.js';

export async function getReadingFonts(userId: string): Promise<ReadingFontItem[]> {
  const prisma = getPrisma();
  const fonts = await prisma.readingFont.findMany({ where: { userId }, orderBy: { position: 'asc' } });
  return fonts.map(mapReadingFontToDto);
}

export async function createReadingFont(userId: string, data: { fontKey: string; label: string; family: string; builtin?: boolean; enabled?: boolean; fileUrl?: string }): Promise<ReadingFontItem> {
  const prisma = getPrisma();
  // Fast-fail: check resource limit outside transaction (non-authoritative, avoids unnecessary tx)
  const count = await prisma.readingFont.count({ where: { userId } });
  if (count >= RESOURCE_LIMITS.MAX_FONTS_PER_USER) {
    throw new AppError(403, `Font limit reached (max ${RESOURCE_LIMITS.MAX_FONTS_PER_USER})`);
  }
  const font = await withSerializableRetry(prisma, async (tx) => {
    // Single query batch: count + last position (reduces serialization conflict window)
    const [txCount, last] = await Promise.all([
      tx.readingFont.count({ where: { userId } }),
      tx.readingFont.findFirst({ where: { userId }, orderBy: { position: 'desc' }, select: { position: true } }),
    ]);
    // Authoritative limit check inside Serializable transaction to prevent race conditions
    if (txCount >= RESOURCE_LIMITS.MAX_FONTS_PER_USER) {
      throw new AppError(403, `Font limit reached (max ${RESOURCE_LIMITS.MAX_FONTS_PER_USER})`);
    }
    return tx.readingFont.create({
      data: { userId, fontKey: data.fontKey, label: data.label, family: data.family, builtin: data.builtin ?? false, enabled: data.enabled ?? true, fileUrl: data.fileUrl || null, position: (last?.position ?? -1) + 1 },
    });
  });
  return mapReadingFontToDto(font);
}

export async function updateReadingFont(fontId: string, userId: string, data: { label?: string; family?: string; enabled?: boolean; fileUrl?: string | null }): Promise<ReadingFontItem> {
  const prisma = getPrisma();
  const font = await prisma.readingFont.findUnique({ where: { id: fontId }, select: { userId: true } });
  if (!font) throw new AppError(404, 'Font not found');
  if (font.userId !== userId) throw new AppError(403, 'Access denied');
  const updated = await prisma.readingFont.update({
    where: { id: fontId },
    data: { ...(data.label !== undefined && { label: data.label }), ...(data.family !== undefined && { family: data.family }), ...(data.enabled !== undefined && { enabled: data.enabled }), ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl }) },
  });
  return mapReadingFontToDto(updated);
}

export async function deleteReadingFont(fontId: string, userId: string): Promise<void> {
  const prisma = getPrisma();
  const font = await prisma.readingFont.findUnique({ where: { id: fontId }, select: { userId: true, fileUrl: true } });
  if (!font) throw new AppError(404, 'Font not found');
  if (font.userId !== userId) throw new AppError(403, 'Access denied');
  await prisma.readingFont.delete({ where: { id: fontId } });
  // Best-effort S3 cleanup
  if (font.fileUrl) {
    const { deleteFileByUrl } = await import('../utils/storage.js');
    await deleteFileByUrl(font.fileUrl).catch((err) => {
      logger.warn({ err, fileUrl: font.fileUrl, fontId }, 'Failed to delete font file from S3');
    });
  }
}

export async function reorderReadingFonts(userId: string, fontIds: string[]): Promise<void> {
  const prisma = getPrisma();
  const fonts = await prisma.readingFont.findMany({ where: { userId, id: { in: fontIds } }, select: { id: true } });
  if (fonts.length !== fontIds.length) throw new AppError(400, 'Some font IDs are invalid');
  await bulkUpdatePositions(prisma, 'reading_fonts', fontIds);
}
