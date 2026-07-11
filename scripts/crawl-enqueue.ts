import { db } from '@/db/client';
import { getPendingPages } from '@/features/pages/api/queries';
import { enqueuePageCrawlJobs } from '@/features/pages/api/queue';

const BATCH_SIZE = 100;

async function main() {
  const pending = await getPendingPages(db, BATCH_SIZE);
  if (pending.length === 0) {
    console.log('No pending pages');
    return;
  }
  const { added } = await enqueuePageCrawlJobs(
    pending.map((p: { id: string; url: string }) => ({ id: p.id, url: p.url, crawlDepth: 0 })),
  );
  console.log(`Enqueued ${added} pages`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
