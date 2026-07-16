import { defineTask } from 'nitro/task';

import { db } from '@/db/client';
import { insertFeeds } from '@/features/feed-sources/api/queries';
import { parseSeedFeeds } from '@/features/feed-sources/utils/parse-seed-feeds';
import { env } from '@/lib/env';

export default defineTask({
  meta: {
    name: 'db:seed',
    description:
      'Insert seed feeds from SEED_FEEDS env var (comma-separated `url:type` pairs) into feeds table',
  },
  async run() {
    const raw = env.seedFeeds;
    if (raw.length === 0) {
      return { result: 'No SEED_FEEDS set — nothing to seed' };
    }
    const discovered = parseSeedFeeds(raw);
    const inserted = await insertFeeds(db, discovered);
    return { result: `Seeded ${inserted} new feeds (of ${discovered.length} attempted)` };
  },
});
