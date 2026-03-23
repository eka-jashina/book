import { Prisma } from '@prisma/client';
import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { RESOURCE_LIMITS } from '../utils/limits.js';
import { bulkUpdatePositions } from '../utils/reorder.js';
import { withSerializableRetry } from '../utils/serializable.js';
import { sanitizeHtml } from '../utils/sanitize.js';
import { mapChapterToListItem, mapChapterToDetail } from '../utils/mappers.js';
import type { ChapterListItem, ChapterDetail } from '../types/api.js';

/** Convert albumData to Prisma-compatible JSON value (Prisma requires DbNull for null JSON). */
function toJsonValue(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

interface PaginatedChapters {
  chapters: ChapterListItem[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Get chapters for a book with pagination (metadata, no content).
 * Book ownership is verified by requireBookOwnership middleware.
 */
export async function getChapters(
  bookId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<PaginatedChapters> {

  const prisma = getPrisma();
  const limit = Math.min(options.limit ?? 100, 500);
  const offset = options.offset ?? 0;

  const [chapters, total] = await Promise.all([
    prisma.chapter.findMany({
      where: { bookId },
      orderBy: { position: 'asc' },
      take: limit,
      skip: offset,
    }),
    prisma.chapter.count({ where: { bookId } }),
  ]);

  return {
    chapters: chapters.map(mapChapterToListItem),
    total,
    limit,
    offset,
  };
}

/**
 * Get a single chapter with all details.
 */
export async function getChapterById(
  bookId: string,
  chapterId: string,
): Promise<ChapterDetail> {

  const prisma = getPrisma();
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  return mapChapterToDetail(chapter);
}

/**
 * Get just the HTML content of a chapter.
 */
export async function getChapterContent(
  bookId: string,
  chapterId: string,
): Promise<string | null> {

  const prisma = getPrisma();
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { bookId: true, htmlContent: true, filePath: true },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  return chapter.htmlContent;
}

/**
 * Create a new chapter in a book.
 */
export async function createChapter(
  bookId: string,
  data: {
    title: string;
    htmlContent?: string;
    filePath?: string;
    bg?: string;
    bgMobile?: string;
    albumData?: unknown;
  },
): Promise<ChapterDetail> {

  const prisma = getPrisma();

  // Fast-fail: check resource limit outside transaction (non-authoritative, avoids unnecessary tx)
  const count = await prisma.chapter.count({ where: { bookId } });
  if (count >= RESOURCE_LIMITS.MAX_CHAPTERS_PER_BOOK) {
    throw new AppError(403, `Chapter limit reached (max ${RESOURCE_LIMITS.MAX_CHAPTERS_PER_BOOK})`);
  }

  const chapter = await withSerializableRetry(prisma, async (tx) => {
    // Single query batch: count + last position (reduces serialization conflict window)
    const [txCount, lastChapter] = await Promise.all([
      tx.chapter.count({ where: { bookId } }),
      tx.chapter.findFirst({
        where: { bookId },
        orderBy: { position: 'desc' },
        select: { position: true },
      }),
    ]);
    // Authoritative limit check inside Serializable transaction to prevent race conditions
    if (txCount >= RESOURCE_LIMITS.MAX_CHAPTERS_PER_BOOK) {
      throw new AppError(403, `Chapter limit reached (max ${RESOURCE_LIMITS.MAX_CHAPTERS_PER_BOOK})`);
    }
    const nextPosition = (lastChapter?.position ?? -1) + 1;

    return tx.chapter.create({
      data: {
        bookId,
        title: data.title,
        position: nextPosition,
        htmlContent: data.htmlContent ? sanitizeHtml(data.htmlContent) : null,
        filePath: data.filePath || null,
        bg: data.bg || '',
        bgMobile: data.bgMobile || '',
        albumData: toJsonValue(data.albumData ?? null),
      },
    });
  });

  return mapChapterToDetail(chapter);
}

/**
 * Update a chapter.
 * Supports optimistic locking via optional `ifUnmodifiedSince` timestamp.
 */
export async function updateChapter(
  bookId: string,
  chapterId: string,
  data: {
    title?: string;
    htmlContent?: string | null;
    filePath?: string | null;
    bg?: string;
    bgMobile?: string;
    albumData?: unknown | null;
    ifUnmodifiedSince?: string;
  },
): Promise<ChapterDetail> {

  const prisma = getPrisma();

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { bookId: true, updatedAt: true },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  // Optimistic locking: reject if chapter was modified after the given timestamp
  if (data.ifUnmodifiedSince) {
    const clientDate = new Date(data.ifUnmodifiedSince);
    if (chapter.updatedAt > clientDate) {
      throw new AppError(409, 'Chapter was modified by another request', 'CONFLICT_DETECTED');
    }
  }

  const updated = await prisma.chapter.update({
    where: { id: chapterId },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.htmlContent !== undefined && { htmlContent: data.htmlContent ? sanitizeHtml(data.htmlContent) : data.htmlContent }),
      ...(data.filePath !== undefined && { filePath: data.filePath }),
      ...(data.bg !== undefined && { bg: data.bg }),
      ...(data.bgMobile !== undefined && { bgMobile: data.bgMobile }),
      ...(data.albumData !== undefined && { albumData: toJsonValue(data.albumData) }),
    },
  });

  return mapChapterToDetail(updated);
}

/**
 * Delete a chapter.
 */
export async function deleteChapter(
  bookId: string,
  chapterId: string,
): Promise<void> {

  const prisma = getPrisma();

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { bookId: true },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  await prisma.chapter.delete({ where: { id: chapterId } });
}

/**
 * Reorder chapters in a book.
 */
export async function reorderChapters(
  bookId: string,
  chapterIds: string[],
): Promise<void> {

  const prisma = getPrisma();

  // Verify all chapters belong to the book
  const chapters = await prisma.chapter.findMany({
    where: { bookId, id: { in: chapterIds } },
    select: { id: true },
  });

  if (chapters.length !== chapterIds.length) {
    throw new AppError(400, 'Some chapter IDs are invalid');
  }

  await bulkUpdatePositions(prisma, 'chapters', chapterIds);
}
