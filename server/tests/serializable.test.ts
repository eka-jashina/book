import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { withSerializableRetry } from '../src/utils/serializable.js';

function createMockPrisma(results: Array<unknown | Error>) {
  let callIndex = 0;

  return {
    $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>, _opts?: unknown) => {
      const result = results[callIndex++];
      if (result instanceof Error) throw result;
      return fn({ mock: true });
    }),
  } as any;
}

describe('withSerializableRetry', () => {
  it('should execute fn successfully on first try', async () => {
    const fn = vi.fn(async () => 'result');
    const prisma = createMockPrisma([undefined]); // $transaction succeeds

    const result = await withSerializableRetry(prisma, fn);

    expect(result).toBe('result');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should retry on P2034 serialization conflict', async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError('Serialization failure', {
      code: 'P2034',
      clientVersion: '5.0.0',
    });

    let attempt = 0;
    const prisma = {
      $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>, _opts?: unknown) => {
        attempt++;
        if (attempt < 3) throw p2034;
        return fn({ mock: true });
      }),
    } as any;

    const fn = vi.fn(async () => 'success');
    const result = await withSerializableRetry(prisma, fn);

    expect(result).toBe('success');
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('should throw after exhausting retries on P2034', async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError('Serialization failure', {
      code: 'P2034',
      clientVersion: '5.0.0',
    });

    const prisma = {
      $transaction: vi.fn(async () => {
        throw p2034;
      }),
    } as any;

    const fn = vi.fn(async () => 'never');
    await expect(withSerializableRetry(prisma, fn, 3)).rejects.toThrow(p2034);
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('should not retry on non-P2034 Prisma errors', async () => {
    const otherError = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });

    const prisma = {
      $transaction: vi.fn(async () => {
        throw otherError;
      }),
    } as any;

    const fn = vi.fn(async () => 'never');
    await expect(withSerializableRetry(prisma, fn)).rejects.toThrow(otherError);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should not retry on generic errors', async () => {
    const genericError = new Error('Something broke');

    const prisma = {
      $transaction: vi.fn(async () => {
        throw genericError;
      }),
    } as any;

    const fn = vi.fn(async () => 'never');
    await expect(withSerializableRetry(prisma, fn)).rejects.toThrow('Something broke');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('should use Serializable isolation level', async () => {
    const prisma = {
      $transaction: vi.fn(async (fn: (tx: any) => Promise<unknown>, opts?: any) => {
        expect(opts).toEqual({
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
        return fn({ mock: true });
      }),
    } as any;

    const fn = vi.fn(async () => 'ok');
    await withSerializableRetry(prisma, fn);
  });

  it('should respect custom retries parameter', async () => {
    const p2034 = new Prisma.PrismaClientKnownRequestError('Serialization failure', {
      code: 'P2034',
      clientVersion: '5.0.0',
    });

    const prisma = {
      $transaction: vi.fn(async () => {
        throw p2034;
      }),
    } as any;

    const fn = vi.fn(async () => 'never');
    await expect(withSerializableRetry(prisma, fn, 5)).rejects.toThrow(p2034);
    expect(prisma.$transaction).toHaveBeenCalledTimes(5);
  });
});
