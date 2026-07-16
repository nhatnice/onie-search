import { Client } from 'pg';

import * as schema from '@/db/schema';
import { env } from '@/lib/env';

async function main() {
  const schemas = new Set<string>();
  for (const value of Object.values(schema)) {
    const tbl = value as unknown as Record<symbol, unknown>;
    if (tbl[Symbol.for('drizzle:IsDrizzleTable')]) {
      const s = tbl[Symbol.for('drizzle:Schema')] as string | undefined;
      if (s) schemas.add(s);
    }
  }

  if (schemas.size === 0) {
    console.log('No custom schemas to create');
    return;
  }

  const client = new Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    for (const schemaName of schemas) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
      console.log(`Schema "${schemaName}" ready`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
