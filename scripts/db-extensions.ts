import { Client } from 'pg';

import { env } from '@/lib/env';

async function main() {
  const client = new Client({ connectionString: env.databaseUrl });
  await client.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_search');
    console.log('ParadeDB pg_search extension ready');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
