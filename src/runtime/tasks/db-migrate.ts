import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { defineTask } from 'nitro/task';
import { Pool } from 'pg';

import { env } from '@/lib/env';

export default defineTask({
  meta: { name: 'db:migrate', description: 'Run Drizzle migrations against DATABASE_URL' },
  async run() {
    const pool = new Pool({ connectionString: env.databaseUrl, max: 1 });
    const db = drizzle(pool);
    try {
      // ponytail: resolve from this file's location so it works in both dev and production builds
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
    } finally {
      await pool.end();
    }
    return { result: 'Migrations applied' };
  },
});
