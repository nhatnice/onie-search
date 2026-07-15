import { defineTask } from 'nitro/task';

import { getDefaultDb, getFeedsToScan } from '@/features/feed-sources/api/queries';
import {
  enqueueFeedDiscoveryJobs,
  ensureFeedDiscoveryQueue,
} from '@/features/feed-sources/api/queue';

const BATCH_SIZE = 100;
const QUEUE_BACKLOG_THRESHOLD = Number(process.env.FEED_DISCOVERY_BACKLOG_THRESHOLD) || 200;

type Queue = ReturnType<typeof ensureFeedDiscoveryQueue>;

async function getBacklog(queue: Queue): Promise<number> {
  const [waiting, active, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
  ]);
  return waiting + active + delayed;
}

export default defineTask({
  meta: {
    name: 'feed:enqueue',
    description: 'Scan feeds due for scanning and push to BullMQ (backpressure-gated)',
  },
  async run() {
    const queue = ensureFeedDiscoveryQueue();
    const inflight = await getBacklog(queue);
    if (inflight >= QUEUE_BACKLOG_THRESHOLD) {
      console.warn(`[feed:enqueue] skip — backlog ${inflight} >= ${QUEUE_BACKLOG_THRESHOLD}`);
      return { result: `Skipped: backlog ${inflight}` };
    }

    const due = await getFeedsToScan(getDefaultDb(), BATCH_SIZE);
    if (due.length === 0) {
      console.warn('[feed:enqueue] no feeds due');
      return { result: 'No feeds due' };
    }
    const { added } = await enqueueFeedDiscoveryJobs(
      due.map((f) => ({ id: f.id, url: f.url, type: f.type })),
    );
    console.warn(`[feed:enqueue] enqueued ${added}/${due.length} feeds`);
    return { result: `Enqueued ${added} feeds` };
  },
});
