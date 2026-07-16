import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';

import type { DbOrTx } from './types';

// PostgreSQL binds at most 65535 params per statement (pg protocol limit).
// Large sitemaps (tinhte.vn) return ~50k URLs per scan — 3 params/row on
// `pages` = 150k binds, exceeding the ceiling. node-postgres rejects the
// bind message before Postgres even sees it, surfacing as
// `08P01: bind message has 18928 parameter formats but 0 parameters`.
// Chunk to stay comfortably under the ceiling and small enough to avoid
// statement-prep timeouts. 1000 rows covers `feeds` (4 params) at 4k
// and `pages` (3 params) at 3k.
const INSERT_CHUNK = 1000;

type WithId = { id: PgColumn } & PgTable;

export async function insertBatched<TTable extends WithId>(
  db: DbOrTx,
  table: TTable,
  rows: readonly TTable['$inferInsert'][],
): Promise<number> {
  if (rows.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const slice = rows.slice(i, i + INSERT_CHUNK);
    const res = await db
      .insert(table)
      .values(slice)
      .onConflictDoNothing()
      .returning({ id: table.id });
    inserted += res.length;
  }
  return inserted;
}
