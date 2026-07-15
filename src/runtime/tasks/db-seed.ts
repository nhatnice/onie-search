import { defineTask } from 'nitro/task';

import { db } from '@/db/client';
import { seedPages } from '@/features/pages/api/services/page-service';
import { env } from '@/lib/env';

function parseSeedUrls(raw: string): string[] {
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

export default defineTask({
  meta: {
    name: 'db:seed',
    description: 'Insert seed URLs from SEED_URLS env var (comma-separated) into pages table',
  },
  async run() {
    const urls = parseSeedUrls(env.seedUrls);
    if (urls.length === 0) {
      return { result: 'No SEED_URLS set — nothing to seed' };
    }
    const { inserted } = await seedPages(db, urls);
    return { result: `Seeded ${inserted} new pages (of ${urls.length} attempted)` };
  },
});
