import { Queue } from 'bullmq';

import { getRedisConnection } from '@/redis/client';

export const PAGE_CRAWL_QUEUE = 'page-crawl';
const PAGE_CRAWL_JOB = 'page-crawl';

export interface PageCrawlJobData {
  pageId: string;
  url: string;
  crawlDepth: number;
}

let queueInstance: Queue<PageCrawlJobData> | undefined;

export function ensurePageCrawlQueue(): Queue<PageCrawlJobData> {
  if (!queueInstance) {
    queueInstance = new Queue<PageCrawlJobData>(PAGE_CRAWL_QUEUE, {
      connection: getRedisConnection(),
    });
  }
  return queueInstance;
}

/**
 * Enqueue pages for crawling. BullMQ dedup via jobId = pageId —
 * re-enqueueing the same page is a no-op.
 */
export async function enqueuePageCrawlJobs(
  pages: Array<{ id: string; url: string; crawlDepth?: number }>,
): Promise<{ added: number }> {
  if (pages.length === 0) return { added: 0 };
  const queue = ensurePageCrawlQueue();
  await queue.addBulk(
    pages.map((p) => ({
      name: PAGE_CRAWL_JOB,
      data: { pageId: p.id, url: p.url, crawlDepth: p.crawlDepth ?? 0 },
      opts: {
        jobId: p.id,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })),
  );
  return { added: pages.length };
}
