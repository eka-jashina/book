import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/** Tables that support position-based reordering. */
const REORDERABLE_TABLES = new Set(['books', 'chapters', 'ambients', 'reading_fonts']);

/**
 * Bulk-update position column for a set of IDs in a single SQL statement.
 * Uses parameterized query via Prisma.sql to prevent SQL injection.
 */
export async function bulkUpdatePositions(
  tx: TransactionClient,
  table: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  if (!REORDERABLE_TABLES.has(table)) {
    throw new Error(`Table "${table}" is not allowed for reordering`);
  }

  // Build a safe VALUES clause using Prisma.sql tagged template
  // We use Prisma.join for the CASE/WHEN pattern since $executeRaw requires tagged templates
  const whenClauses = ids.map((id, i) =>
    Prisma.sql`WHEN id = ${id}::uuid THEN ${i}`,
  );

  const idParams = ids.map((id) => Prisma.sql`${id}::uuid`);

  await tx.$executeRaw`
    UPDATE ${Prisma.raw(`"${table}"`)}
    SET "position" = CASE ${Prisma.join(whenClauses, ' ')} END
    WHERE id IN (${Prisma.join(idParams, ', ')})
  `;
}
