import { db } from '@/db/client';
import { seedPages } from '@/features/pages/api/services/page-service';
import { env } from '@/lib/env';

function parseSeedUrls(raw: string): string[] {
  return raw
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

async function main() {
  const urls = parseSeedUrls(env.seedUrls);
  if (urls.length === 0) {
    console.log('No SEED_URLS set — nothing to seed');
    return;
  }
  const { inserted } = await seedPages(db, urls);
  console.log(`Seeded ${inserted} new pages (of ${urls.length} attempted)`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
