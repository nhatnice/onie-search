import { Queue, type ConnectionOptions } from 'bullmq';

import { createRedisClient } from './client';

// Shared connection for all Queues
const sharedConnection = createRedisClient();

export const pageCrawlQueue = new Queue('page-crawl', {
  connection: sharedConnection as unknown as ConnectionOptions,
});

export const feedDiscoveryWorkerQueue = new Queue('feed-discovery-worker', {
  connection: sharedConnection as unknown as ConnectionOptions,
});

export const feedDiscoveryDispatcherQueue = new Queue('feed-discovery-dispatcher', {
  connection: sharedConnection as unknown as ConnectionOptions,
});

export async function closeQueues(): Promise<void> {
  await Promise.all([
    pageCrawlQueue.close(),
    feedDiscoveryWorkerQueue.close(),
    feedDiscoveryDispatcherQueue.close(),
  ]);
  await sharedConnection.quit();
}
