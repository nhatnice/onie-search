import { db } from '@/db/client';
import { getFeedsToScan } from '@/features/feed-sources/api/queries';
import { inngest } from '@/inngest/client';
import { FEED_DISCOVERY_REQUESTED, type FeedDiscoveryRequestedData } from '@/inngest/events';

async function main() {
  const due = await getFeedsToScan(db, 100);
  if (due.length === 0) {
    console.log('No feeds due');
    return;
  }
  const payload = due.map((f) => ({
    name: FEED_DISCOVERY_REQUESTED,
    data: { feedId: f.id, url: f.url, type: f.type } satisfies FeedDiscoveryRequestedData,
  }));
  const { ids } = await inngest.send(payload);
  console.log(`Dispatched ${due.length} feeds (event ids: ${ids.length})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
