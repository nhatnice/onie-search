import { db } from '@/db/client';
import { insertFeeds } from '@/features/feed-sources/api/queries';
import { parseSeedFeeds } from '@/features/feed-sources/utils/parse-seed-feeds';
import { env } from '@/lib/env';

async function main() {
  const raw = env.seedFeeds;
  if (raw.length === 0) {
    console.log('No SEED_FEEDS set — nothing to seed');
    return;
  }
  const discovered = parseSeedFeeds(raw);
  const inserted = await insertFeeds(db, discovered);
  console.log(`Seeded ${inserted} new feeds (of ${discovered.length} attempted)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
