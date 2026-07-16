import { feedDiscoveryWorkerQueue, pageCrawlQueue } from '@/redis/queues';

import { eventEmitter, FEED_DISCOVERY_REQUESTED, PAGE_CREATED, PAGES_CREATED } from './emitter';
import type { FeedDiscoveryRequestedData, PageCreatedData, PagesCreatedData } from './emitter';

export function setupEventListeners(): void {
  eventEmitter.on(PAGE_CREATED, async (data: PageCreatedData) => {
    await pageCrawlQueue
      .add('page-crawl', data, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      })
      .catch((err) => {
        console.error('[events] Failed to add page-crawl job', err);
      });
  });

  eventEmitter.on(PAGES_CREATED, async (data: PagesCreatedData) => {
    const { pages } = data;
    if (pages.length === 0) return;

    const CHUNK_SIZE = 1000;
    for (let i = 0; i < pages.length; i += CHUNK_SIZE) {
      const chunk = pages.slice(i, i + CHUNK_SIZE);
      const jobs = chunk.map((p) => ({
        name: 'page-crawl',
        data: p,
        opts: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: true,
        },
      }));

      try {
        // eslint-disable-next-line eslint/no-await-in-loop
        await pageCrawlQueue.addBulk(jobs);
      } catch (err) {
        console.error('[events] Failed to add bulk page-crawl jobs', err);
      }
    }
  });

  eventEmitter.on(FEED_DISCOVERY_REQUESTED, async (data: FeedDiscoveryRequestedData) => {
    // Use feedId as jobId to ensure idempotency while in queue
    await feedDiscoveryWorkerQueue
      .add('feed-discovery-worker', data, {
        jobId: data.feedId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: true,
      })
      .catch((err) => {
        console.error('[events] Failed to add feed-discovery-worker job', err);
      });
  });
}
