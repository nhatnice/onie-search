import { defineTask } from 'nitro/task';

import { db } from '@/db/client';
import { getPendingPages } from '@/features/pages/api/queries';
import { enqueuePageCrawlJobs } from '@/features/pages/api/queue';

const BATCH_SIZE = 100;

export default defineTask({
  meta: { name: 'crawl:enqueue', description: 'Scan pending pages and push to BullMQ' },
  async run() {
    const pending = await getPendingPages(db, BATCH_SIZE);
    if (pending.length === 0) {
      console.warn('[crawl:enqueue] no pending pages');
      return { result: 'No pending pages' };
    }
    const { added } = await enqueuePageCrawlJobs(
      pending.map((p) => ({ id: p.id, url: p.url, crawlDepth: 0 })),
    );
    console.warn(`[crawl:enqueue] enqueued ${added}/${pending.length} pending pages`);
    return { result: `Enqueued ${added} pages` };
  },
});
