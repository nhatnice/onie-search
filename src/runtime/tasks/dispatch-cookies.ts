import { defineTask } from 'nitro/task';

import { db } from '@/db/client';
import { getCookiesToRefresh } from '@/features/social/api/queries';
import { cookieRefreshWorkerQueue } from '@/redis/queues';
import { BATCH_SIZE } from '@/redis/workers';

export default defineTask({
  meta: {
    name: 'dispatch-cookies',
    description:
      'Query due cookies and addBulk to cookie-refresh-worker BullMQ queue (hourly, run via Nitro scheduledTasks)',
  },
  async run() {
    const due = await getCookiesToRefresh(db, BATCH_SIZE);
    if (due.length === 0) {
      return { result: 'No cookies due' };
    }

    const jobs = due.map((c) => ({
      name: 'cookie-refresh-worker',
      data: {
        cookieId: c.id,
        accountId: c.accountId,
        platformId: c.platformId,
      },
      opts: {
        jobId: c.id,
        attempts: 2,
        backoff: { type: 'exponential' as const, delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    }));

    try {
      await cookieRefreshWorkerQueue.addBulk(jobs);
    } catch (err) {
      console.error('[cookie-refresh] Failed to enqueue jobs', err);
    }
    console.warn(`[cookie-refresh] dispatched ${due.length} cookies`);
    return { result: `Dispatched ${due.length} cookies` };
  },
});
