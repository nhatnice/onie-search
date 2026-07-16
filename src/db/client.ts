import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { env } from '@/lib/env';

import * as schema from './schema';

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  options: '-c search_path=crawler,public',
});

export const db = drizzle(pool, { schema });
export type Db = typeof db;
