import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyBookOwnership } from '../src/utils/ownership.js';
import { AppError } from '../src/middleware/errorHandler.js';

vi.mock('../src/utils/prisma.js', () => ({
  getPrisma: vi.fn(() => ({
    book: {
      findFirst: vi.fn(),
    },
  })),
}));

import { getPrisma } from '../src/utils/prisma.js';

describe('verifyBookOwnership', () => {
  let mockFindFirst: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst = vi.fn();
    vi.mocked(getPrisma).mockReturnValue({
      book: { findFirst: mockFindFirst },
    } as any);
  });

  it('should resolve when book belongs to user', async () => {
    mockFindFirst.mockResolvedValue({ userId: 'user-1' });

    await expect(verifyBookOwnership('book-1', 'user-1')).resolves.toBeUndefined();

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'book-1', deletedAt: null },
      select: { userId: true },
    });
  });

  it('should throw 404 when book not found', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(verifyBookOwnership('missing-book', 'user-1')).rejects.toThrow(AppError);
    await expect(verifyBookOwnership('missing-book', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Book not found',
    });
  });

  it('should throw 403 when book belongs to another user', async () => {
    mockFindFirst.mockResolvedValue({ userId: 'user-2' });

    await expect(verifyBookOwnership('book-1', 'user-1')).rejects.toThrow(AppError);
    await expect(verifyBookOwnership('book-1', 'user-1')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Access denied',
    });
  });

  it('should filter out soft-deleted books', async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(verifyBookOwnership('deleted-book', 'user-1')).rejects.toThrow(AppError);

    expect(mockFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      }),
    );
  });
});
