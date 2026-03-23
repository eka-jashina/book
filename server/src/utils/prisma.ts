import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | null = null;

/**
 * Get or initialize the Prisma client singleton.
 *
 * Connection pool is configured via DATABASE_URL query params:
 * - connection_limit: max connections in pool (default: num_cpus * 2 + 1)
 * - pool_timeout: seconds to wait for available connection (default: 10)
 *
 * Example: DATABASE_URL="postgresql://...?connection_limit=20&pool_timeout=15"
 */
export function getPrisma(): PrismaClient {
  if (prisma) return prisma;

  prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
    // Prisma uses the connection pool params from DATABASE_URL automatically.
    // Explicit datasources override can be used for programmatic pool tuning:
    //   datasources: { db: { url: process.env.DATABASE_URL } }
  });

  return prisma;
}

/**
 * Verify database connectivity and pool configuration at startup.
 * Call this once during server initialization to fail fast on misconfiguration.
 */
export async function validateConnection(): Promise<void> {
  const client = getPrisma();
  await client.$queryRaw`SELECT 1`;
}

export async function disconnectPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
