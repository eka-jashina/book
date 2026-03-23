import { getPrisma } from '../utils/prisma.js';

export interface ReadingSessionInput {
  startPage: number;
  endPage: number;
  pagesRead: number;
  durationSec: number;
  startedAt: string;
}

export interface ReadingSessionDto {
  id: string;
  bookId: string;
  startPage: number;
  endPage: number;
  pagesRead: number;
  durationSec: number;
  startedAt: string;
  endedAt: string;
}

/**
 * Создать запись о сессии чтения
 */
export async function createReadingSession(
  bookId: string,
  userId: string,
  data: ReadingSessionInput,
): Promise<ReadingSessionDto> {
  const prisma = getPrisma();

  const session = await prisma.readingSession.create({
    data: {
      userId,
      bookId,
      startPage: data.startPage,
      endPage: data.endPage,
      pagesRead: data.pagesRead,
      durationSec: data.durationSec,
      startedAt: new Date(data.startedAt),
      endedAt: new Date(),
    },
  });

  return mapSessionToDto(session);
}

/**
 * Получить историю сессий чтения для книги (с пагинацией)
 */
export async function getReadingSessions(
  bookId: string,
  userId: string,
  limit = 50,
  offset = 0,
): Promise<{ sessions: ReadingSessionDto[]; total: number }> {
  const prisma = getPrisma();

  const [sessions, total] = await Promise.all([
    prisma.readingSession.findMany({
      where: { userId, bookId },
      orderBy: { endedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.readingSession.count({ where: { userId, bookId } }),
  ]);

  return {
    sessions: sessions.map(mapSessionToDto),
    total,
  };
}

/**
 * Статистика чтения по книге: общее время, страниц прочитано, количество сессий
 */
export async function getReadingStats(
  bookId: string,
  userId: string,
): Promise<{ totalSessions: number; totalPages: number; totalDurationSec: number }> {
  const prisma = getPrisma();

  const result = await prisma.readingSession.aggregate({
    where: { userId, bookId },
    _count: { id: true },
    _sum: { pagesRead: true, durationSec: true },
  });

  return {
    totalSessions: result._count.id,
    totalPages: result._sum.pagesRead ?? 0,
    totalDurationSec: result._sum.durationSec ?? 0,
  };
}

function mapSessionToDto(session: {
  id: string;
  bookId: string;
  startPage: number;
  endPage: number;
  pagesRead: number;
  durationSec: number;
  startedAt: Date;
  endedAt: Date;
}): ReadingSessionDto {
  return {
    id: session.id,
    bookId: session.bookId,
    startPage: session.startPage,
    endPage: session.endPage,
    pagesRead: session.pagesRead,
    durationSec: session.durationSec,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt.toISOString(),
  };
}
