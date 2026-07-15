import { db } from '@/db/client';
import { getFeedsToScan } from '@/features/feeds/api/queries';
import { enqueueFeedDiscoveryJobs } from '@/features/feeds/api/queue';

async function main() {
  const due = await getFeedsToScan(db, 100);
  if (due.length === 0) {
    console.log('No feeds due');
    return;
  }
  const { added } = await enqueueFeedDiscoveryJobs(
    due.map((f) => ({ id: f.id, url: f.url, type: f.type })),
  );
  console.log(`Enqueued ${added} of ${due.length} feeds`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
