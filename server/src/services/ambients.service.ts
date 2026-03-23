import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESOURCE_LIMITS } from '../utils/limits.js';
import { bulkUpdatePositions } from '../utils/reorder.js';
import { withSerializableRetry } from '../utils/serializable.js';
import { mapAmbientToDto } from '../utils/mappers.js';
import type { AmbientItem } from '../types/api.js';

/**
 * Get all ambients for a book.
 */
export async function getAmbients(
  bookId: string,
): Promise<AmbientItem[]> {

  const prisma = getPrisma();
  const ambients = await prisma.ambient.findMany({
    where: { bookId },
    orderBy: { position: 'asc' },
  });

  return ambients.map(mapAmbientToDto);
}

/**
 * Create a new ambient for a book.
 */
export async function createAmbient(
  bookId: string,
  data: {
    ambientKey: string;
    label: string;
    shortLabel?: string;
    icon?: string;
    fileUrl?: string;
    visible?: boolean;
    builtin?: boolean;
  },
): Promise<AmbientItem> {

  const prisma = getPrisma();

  // Fast-fail: check resource limit outside transaction (non-authoritative, avoids unnecessary tx)
  const count = await prisma.ambient.count({ where: { bookId } });
  if (count >= RESOURCE_LIMITS.MAX_AMBIENTS_PER_BOOK) {
    throw new AppError(403, `Ambient limit reached (max ${RESOURCE_LIMITS.MAX_AMBIENTS_PER_BOOK})`);
  }

  const ambient = await withSerializableRetry(prisma, async (tx) => {
    // Authoritative limit check inside Serializable transaction to prevent race conditions
    const txCount = await tx.ambient.count({ where: { bookId } });
    if (txCount >= RESOURCE_LIMITS.MAX_AMBIENTS_PER_BOOK) {
      throw new AppError(403, `Ambient limit reached (max ${RESOURCE_LIMITS.MAX_AMBIENTS_PER_BOOK})`);
    }

    const lastAmbient = await tx.ambient.findFirst({
      where: { bookId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = (lastAmbient?.position ?? -1) + 1;

    return tx.ambient.create({
      data: {
        bookId,
        ambientKey: data.ambientKey,
        label: data.label,
        shortLabel: data.shortLabel || null,
        icon: data.icon || null,
        fileUrl: data.fileUrl || null,
        visible: data.visible ?? true,
        builtin: data.builtin ?? false,
        position: nextPosition,
      },
    });
  });

  return mapAmbientToDto(ambient);
}

/**
 * Update an ambient.
 */
export async function updateAmbient(
  bookId: string,
  ambientId: string,
  data: {
    ambientKey?: string;
    label?: string;
    shortLabel?: string | null;
    icon?: string | null;
    fileUrl?: string | null;
    visible?: boolean;
  },
): Promise<AmbientItem> {

  const prisma = getPrisma();
  const ambient = await prisma.ambient.findUnique({
    where: { id: ambientId },
    select: { bookId: true },
  });

  if (!ambient || ambient.bookId !== bookId) {
    throw new AppError(404, 'Ambient not found');
  }

  const updated = await prisma.ambient.update({
    where: { id: ambientId },
    data: {
      ...(data.ambientKey !== undefined && { ambientKey: data.ambientKey }),
      ...(data.label !== undefined && { label: data.label }),
      ...(data.shortLabel !== undefined && { shortLabel: data.shortLabel }),
      ...(data.icon !== undefined && { icon: data.icon }),
      ...(data.fileUrl !== undefined && { fileUrl: data.fileUrl }),
      ...(data.visible !== undefined && { visible: data.visible }),
    },
  });

  return mapAmbientToDto(updated);
}

/**
 * Delete an ambient.
 */
export async function deleteAmbient(
  bookId: string,
  ambientId: string,
): Promise<void> {

  const prisma = getPrisma();
  const ambient = await prisma.ambient.findUnique({
    where: { id: ambientId },
    select: { bookId: true, fileUrl: true },
  });

  if (!ambient || ambient.bookId !== bookId) {
    throw new AppError(404, 'Ambient not found');
  }

  await prisma.ambient.delete({ where: { id: ambientId } });
  // Best-effort S3 cleanup
  if (ambient.fileUrl) {
    const { deleteFileByUrl } = await import('../utils/storage.js');
    await deleteFileByUrl(ambient.fileUrl).catch(() => {});
  }
}

/**
 * Reorder ambients for a book.
 */
export async function reorderAmbients(
  bookId: string,
  ambientIds: string[],
): Promise<void> {

  const prisma = getPrisma();
  const ambients = await prisma.ambient.findMany({
    where: { bookId, id: { in: ambientIds } },
    select: { id: true },
  });

  if (ambients.length !== ambientIds.length) {
    throw new AppError(400, 'Some ambient IDs are invalid');
  }

  await bulkUpdatePositions(prisma, 'ambients', ambientIds);
}
