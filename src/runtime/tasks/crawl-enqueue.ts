import { defineTask } from 'nitro/task';

import { db } from '@/db/client';
import { getPendingPages } from '@/features/pages/api/queries';
import { ensurePageCrawlQueue, enqueuePageCrawlJobs } from '@/features/pages/api/queue';

const BATCH_SIZE = 100;
const QUEUE_BACKLOG_THRESHOLD = Number(process.env.PAGE_CRAWL_BACKLOG_THRESHOLD) || 200;

type Queue = ReturnType<typeof ensurePageCrawlQueue>;

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
    name: 'crawl:enqueue',
    description: 'Scan pending pages and push to BullMQ (backpressure-gated)',
  },
  async run() {
    const queue = ensurePageCrawlQueue();
    const inflight = await getBacklog(queue);
    if (inflight >= QUEUE_BACKLOG_THRESHOLD) {
      console.warn(`[crawl:enqueue] skip — backlog ${inflight} >= ${QUEUE_BACKLOG_THRESHOLD}`);
      return { result: `Skipped: backlog ${inflight}` };
    }

    const pending = await getPendingPages(db, BATCH_SIZE);
    if (pending.length === 0) {
      console.warn('[crawl:enqueue] no pending pages');
      return { result: 'No pending pages' };
    }
    const { added } = await enqueuePageCrawlJobs(pending.map((p) => ({ id: p.id, url: p.url })));
    console.warn(`[crawl:enqueue] enqueued ${added}/${pending.length} pending pages`);
    return { result: `Enqueued ${added} pages` };
  },
});
