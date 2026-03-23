import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { mapReadingProgressToDto } from '../utils/mappers.js';
import type { ReadingProgressDetail } from '../types/api.js';

export async function getReadingProgress(bookId: string, userId: string): Promise<ReadingProgressDetail | null> {
  const prisma = getPrisma();

  const [progress, preferences] = await Promise.all([
    prisma.readingProgress.findUnique({ where: { userId_bookId: { userId, bookId } } }),
    prisma.readingPreferences.findUnique({ where: { userId_bookId: { userId, bookId } } }),
  ]);

  if (!progress) return null;

  return mapReadingProgressToDto(progress, preferences);
}

export async function upsertReadingProgress(
  bookId: string,
  userId: string,
  data: {
    page: number;
    font: string;
    fontSize: number;
    theme: string;
    soundEnabled: boolean;
    soundVolume: number;
    ambientType: string;
    ambientVolume: number;
    ifUnmodifiedSince?: string;
  },
): Promise<ReadingProgressDetail> {
  const prisma = getPrisma();

  // Optimistic locking: reject if progress was modified after the given timestamp
  if (data.ifUnmodifiedSince) {
    const existing = await prisma.readingProgress.findUnique({
      where: { userId_bookId: { userId, bookId } },
      select: { updatedAt: true },
    });
    if (existing) {
      const clientDate = new Date(data.ifUnmodifiedSince);
      if (existing.updatedAt > clientDate) {
        throw new AppError(409, 'Reading progress was modified by another session', 'CONFLICT_DETECTED');
      }
    }
  }

  const { font, fontSize, theme, soundEnabled, soundVolume, ambientType, ambientVolume, page } = data;
  const preferencesData = { font, fontSize, theme, soundEnabled, soundVolume, ambientType, ambientVolume };

  const [progress] = await Promise.all([
    prisma.readingProgress.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: { userId, bookId, page },
      update: { page },
    }),
    prisma.readingPreferences.upsert({
      where: { userId_bookId: { userId, bookId } },
      create: { userId, bookId, ...preferencesData },
      update: preferencesData,
    }),
  ]);

  return {
    page: progress.page,
    ...preferencesData,
    updatedAt: progress.updatedAt.toISOString(),
  };
}
