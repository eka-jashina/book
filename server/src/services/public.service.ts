import { getPrisma } from '../utils/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  mapBookToDetail,
  mapUserToPublicAuthor,
  mapBookToPublicCard,
  mapChapterToListItem,
} from '../utils/mappers.js';
import { logger } from '../utils/logger.js';
import type {
  PublicBookCard,
  PublicShelf,
  PublicBookDetail,
  DiscoverResult,
} from '../types/api.js';

/**
 * Get an author's public shelf: profile + published books.
 */
export async function getShelf(username: string): Promise<PublicShelf> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      books: {
        where: { visibility: 'published', deletedAt: null },
        orderBy: { position: 'asc' },
        take: 200,
        include: {
          _count: { select: { chapters: true } },
          appearance: {
            select: {
              lightCoverBgStart: true,
              lightCoverBgEnd: true,
              lightCoverText: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'Author not found');
  }

  return {
    author: mapUserToPublicAuthor(user),
    books: user.books.map(mapBookToPublicCard),
  };
}

/**
 * Get full details of a public book by author username + slug.
 */
export async function getPublicBookBySlug(
  username: string,
  slug: string,
): Promise<PublicBookDetail> {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, displayName: true, avatarUrl: true, bio: true },
  });

  if (!user) throw new AppError(404, 'Author not found');

  const book = await prisma.book.findFirst({
    where: { userId: user.id, slug, deletedAt: null },
    include: {
      chapters: { orderBy: { position: 'asc' } },
      appearance: true,
      sounds: true,
      ambients: { orderBy: { position: 'asc' } },
      decorativeFont: true,
      defaultSettings: true,
    },
  });

  if (!book || book.visibility === 'draft') {
    throw new AppError(404, 'Book not found');
  }

  return {
    ...mapBookToDetail(book),
    owner: mapUserToPublicAuthor(user),
  };
}

/**
 * Get full details of a public book (published or unlisted).
 */
export async function getPublicBook(bookId: string): Promise<PublicBookDetail> {
  const prisma = getPrisma();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    include: {
      user: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
          bio: true,
        },
      },
      chapters: { orderBy: { position: 'asc' } },
      appearance: true,
      sounds: true,
      ambients: { orderBy: { position: 'asc' } },
      decorativeFont: true,
      defaultSettings: true,
    },
  });

  if (!book || book.visibility === 'draft' || book.deletedAt !== null) {
    throw new AppError(404, 'Book not found');
  }

  if (!book.user.username) {
    throw new AppError(404, 'Book not found');
  }

  return {
    ...mapBookToDetail(book),
    owner: mapUserToPublicAuthor(book.user),
  };
}

/**
 * Get chapters for a public book (metadata only, no content).
 */
export async function getPublicChapters(bookId: string) {
  const prisma = getPrisma();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { visibility: true, deletedAt: true },
  });

  if (!book || book.visibility === 'draft' || book.deletedAt !== null) {
    throw new AppError(404, 'Book not found');
  }

  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    orderBy: { position: 'asc' },
  });

  return chapters.map(mapChapterToListItem);
}

/**
 * Get chapter content for a public book.
 */
export async function getPublicChapterContent(
  bookId: string,
  chapterId: string,
): Promise<string | null> {
  const prisma = getPrisma();

  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { visibility: true, deletedAt: true },
  });

  if (!book || book.visibility === 'draft' || book.deletedAt !== null) {
    throw new AppError(404, 'Book not found');
  }

  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { bookId: true, htmlContent: true },
  });

  if (!chapter || chapter.bookId !== bookId) {
    throw new AppError(404, 'Chapter not found');
  }

  return chapter.htmlContent;
}

/**
 * Discover public books with pagination (newest first).
 */
export async function discoverBooks(
  options: { limit?: number; offset?: number } = {},
): Promise<DiscoverResult> {
  const prisma = getPrisma();
  const limit = Math.min(options.limit ?? 20, 50);
  const offset = options.offset ?? 0;

  const where = { visibility: 'published' as const, deletedAt: null };

  try {
    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          _count: { select: { chapters: true } },
          user: {
            select: {
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
            },
          },
          appearance: {
            select: {
              lightCoverBgStart: true,
              lightCoverBgEnd: true,
              lightCoverText: true,
            },
          },
        },
      }),
      prisma.book.count({ where }),
    ]);

    return {
      books: books
        .filter((b) => b.user.username !== null)
        .map((book) => ({
          ...mapBookToPublicCard(book),
          owner: mapUserToPublicAuthor(book.user),
        })),
      total,
      limit,
      offset,
    };
  } catch (err) {
    logger.warn({ err }, 'discoverBooks: database query failed, returning empty result');
    return { books: [], total: 0, limit, offset };
  }
}
