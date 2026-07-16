import { feedDiscoveryWorkerQueue, pageCrawlQueue } from '@/redis/queues';

import { eventEmitter, FEED_DISCOVERY_REQUESTED, PAGE_CREATED } from './emitter';
import type { FeedDiscoveryRequestedData, PageCreatedData } from './emitter';

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
