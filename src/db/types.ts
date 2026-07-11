import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

export type DbOrTx<TSchema extends Record<string, unknown> = Record<string, unknown>> =
  | NodePgDatabase<TSchema>
  | Omit<NodePgDatabase<TSchema>, '$client'>;
