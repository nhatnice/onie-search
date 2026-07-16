import { db } from '@/db/client';
import { eventEmitter, FEED_DISCOVERY_REQUESTED } from '@/events/emitter';
import { setupEventListeners } from '@/events/listeners';
import { getFeedsToScan } from '@/features/feed-sources/api/queries';
import { closeQueues } from '@/redis';

async function main() {
  setupEventListeners();

  const due = await getFeedsToScan(db, 100);
  if (due.length === 0) {
    console.log('No feeds due');
    return;
  }

  const promises = due.map((f) =>
    eventEmitter.emitAsync(FEED_DISCOVERY_REQUESTED, {
      feedId: f.id,
      url: f.url,
      type: f.type,
    }),
  );
  await Promise.all(promises);

  console.log(`Dispatched ${due.length} feeds`);

  await closeQueues();
  process.exit(0);
}

main().catch(async (err) => {
  console.error(err);
  try {
    await closeQueues();
  } catch {}
  process.exit(1);
});
