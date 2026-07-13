import { Queue } from 'bullmq';

import { getRedisConnection } from '@/redis/client';

export const PAGE_CRAWL_QUEUE = 'page-crawl';
const PAGE_CRAWL_JOB = 'page-crawl';

export interface PageCrawlJobData {
  pageId: string;
  url: string;
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

const DEFAULT_JOB_OPTS = {
  attempts: 1,
  removeOnComplete: 100,
  removeOnFail: true,
};

export async function enqueuePageCrawlJobs(
  pages: Array<{ id: string; url: string }>,
): Promise<{ added: number }> {
  if (pages.length === 0) return { added: 0 };
  const queue = ensurePageCrawlQueue();
  await queue.addBulk(
    pages.map((p) => ({
      name: PAGE_CRAWL_JOB,
      data: { pageId: p.id, url: p.url },
      opts: { jobId: p.id, ...DEFAULT_JOB_OPTS },
    })),
  );
  return { added: pages.length };
}
