import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/**
 * Execute a callback inside a Serializable transaction with automatic retry
 * on serialization conflicts (Prisma error P2034).
 */
export async function withSerializableRetry<T>(
  prisma: PrismaClient,
  fn: (tx: TransactionClient) => Promise<T>,
  retries = 5,
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2034' &&
        i < retries - 1
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new Error('Unreachable');
}
