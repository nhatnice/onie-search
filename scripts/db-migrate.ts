import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

import { env } from '@/lib/env';

async function main() {
  const pool = new Pool({ connectionString: env.databaseUrl, max: 1 });
  const db = drizzle(pool);
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      resolve(here, 'drizzle'),
      resolve(here, '../../drizzle'),
      resolve(here, '../../../drizzle'),
      resolve(process.cwd(), 'drizzle'),
    ];
    const migrationsFolder = candidates.find((p) => existsSync(p));
    if (!migrationsFolder)
      throw new Error(`Cannot find drizzle migrations folder in: ${candidates.join(', ')}`);
    await migrate(db, { migrationsFolder });
    console.log('Migrations applied');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
