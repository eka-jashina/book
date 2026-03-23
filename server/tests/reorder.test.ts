import { describe, it, expect, vi } from 'vitest';
import { bulkUpdatePositions } from '../src/utils/reorder.js';

describe('bulkUpdatePositions', () => {
  it('should do nothing for empty ids array', async () => {
    const tx = { $executeRaw: vi.fn() } as any;
    await bulkUpdatePositions(tx, 'books', []);
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('should throw for non-allowed table name', async () => {
    const tx = { $executeRaw: vi.fn() } as any;
    await expect(bulkUpdatePositions(tx, 'users', ['id-1'])).rejects.toThrow(
      'Table "users" is not allowed for reordering',
    );
  });

  it('should accept "books" as a valid table', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) } as any;
    await expect(bulkUpdatePositions(tx, 'books', ['id-1'])).resolves.toBeUndefined();
    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it('should accept "chapters" as a valid table', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(2) } as any;
    await expect(bulkUpdatePositions(tx, 'chapters', ['a', 'b'])).resolves.toBeUndefined();
  });

  it('should accept "ambients" as a valid table', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) } as any;
    await expect(bulkUpdatePositions(tx, 'ambients', ['id-1'])).resolves.toBeUndefined();
  });

  it('should accept "reading_fonts" as a valid table', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(1) } as any;
    await expect(bulkUpdatePositions(tx, 'reading_fonts', ['id-1'])).resolves.toBeUndefined();
  });

  it('should reject arbitrary table names for SQL injection prevention', async () => {
    const tx = { $executeRaw: vi.fn() } as any;
    await expect(bulkUpdatePositions(tx, 'users; DROP TABLE books;--', ['id-1'])).rejects.toThrow(
      'is not allowed for reordering',
    );
  });

  it('should call $executeRaw with the ids', async () => {
    const tx = { $executeRaw: vi.fn().mockResolvedValue(3) } as any;
    await bulkUpdatePositions(tx, 'books', ['id-a', 'id-b', 'id-c']);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });
});
