import { Queue } from 'bullmq';

import { getRedisConnection } from '@/redis/client';

import type { FeedType } from './schema';

export const FEED_DISCOVERY_QUEUE = 'feed-discovery';
const FEED_DISCOVERY_JOB = 'feed-discovery';

export interface FeedDiscoveryJobData {
  feedId: string;
  url: string;
  type: FeedType;
}

let queueInstance: Queue<FeedDiscoveryJobData> | undefined;

export function ensureFeedDiscoveryQueue(): Queue<FeedDiscoveryJobData> {
  if (!queueInstance) {
    queueInstance = new Queue<FeedDiscoveryJobData>(FEED_DISCOVERY_QUEUE, {
      connection: getRedisConnection(),
    });
  }
  return queueInstance;
}

const DEFAULT_JOB_OPTS = {
  attempts: 3,
  removeOnComplete: 100,
  removeOnFail: { count: 1000 },
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
};

export async function enqueueFeedDiscoveryJobs(
  feeds: Array<{ id: string; url: string; type: FeedType }>,
): Promise<{ added: number }> {
  if (feeds.length === 0) return { added: 0 };
  const queue = ensureFeedDiscoveryQueue();
  await queue.addBulk(
    feeds.map((f) => ({
      name: FEED_DISCOVERY_JOB,
      data: { feedId: f.id, url: f.url, type: f.type },
      opts: { jobId: f.id, ...DEFAULT_JOB_OPTS },
    })),
  );
  return { added: feeds.length };
}
