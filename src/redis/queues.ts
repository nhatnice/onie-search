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

export const cookieRefreshWorkerQueue = new Queue('cookie-refresh-worker', {
  connection: sharedConnection as unknown as ConnectionOptions,
});

export const postReactCrawlQueue = new Queue('post-react-crawl', {
  connection: sharedConnection as unknown as ConnectionOptions,
});

export async function closeQueues(): Promise<void> {
  await Promise.all([
    pageCrawlQueue.close(),
    feedDiscoveryWorkerQueue.close(),
    cookieRefreshWorkerQueue.close(),
    postReactCrawlQueue.close(),
  ]);
  await sharedConnection.quit();
}
