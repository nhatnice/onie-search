import { db } from '@/db/client';
import {
  eventEmitter,
  FEED_DISCOVERY_REQUESTED,
  type FeedDiscoveryRequestedData,
} from '@/events/emitter';
import { getFeedsToScan } from '@/features/feed-sources/api/queries';
import { buildPhoneExtractJobs } from '@/features/social/api/services/phone-extract-service';
import { buildPostReactJobs } from '@/features/social/api/services/post-react-service';
import { env } from '@/lib/env';

import { dispatchCapped } from './dispatch';
import { phoneExtractWorkerQueue, postReactCrawlQueue } from './queues';

export const BATCH_SIZE = 100;

// Exported for Nitro task `dispatch-feeds` to emit events
export async function dispatchFeeds(): Promise<unknown> {
  const due = await getFeedsToScan(db, BATCH_SIZE);
  if (due.length === 0) {
    return { result: 'No feeds due' };
  }
  for (const f of due) {
    eventEmitter.emit(FEED_DISCOVERY_REQUESTED, {
      feedId: f.id,
      url: f.url,
      type: f.type,
    } satisfies FeedDiscoveryRequestedData);
  }
  console.warn(`[feed-discovery] dispatched ${due.length} feeds`);
  return { result: `Dispatched ${due.length} feeds` };
}

// Exported for Nitro task `dispatch-post-reacts` to enqueue jobs
export async function dispatchPostReactCrawl(): Promise<unknown> {
  const jobs = await buildPostReactJobs(db, BATCH_SIZE);
  if (jobs.length === 0) {
    return { result: 'No posts due' };
  }
  const bullJobs = jobs.map((j) => ({
    name: 'post-react-crawl',
    data: {
      jobId: j.jobId,
      postId: j.postId,
      postUrl: j.postUrl,
      platformId: j.platformId,
      cookieId: j.cookieId,
    },
    opts: {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 60_000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
  }));
  try {
    await postReactCrawlQueue.addBulk(bullJobs);
  } catch (err) {
    console.error('[post-react] Failed to enqueue jobs', err);
  }
  console.warn(`[post-react] dispatched ${jobs.length} posts`);
  return { result: `Dispatched ${jobs.length} posts` };
}

// Exported for Nitro task `dispatch-phone-extract` to enqueue jobs
export async function dispatchPhoneExtract(): Promise<unknown> {
  return dispatchCapped({
    queue: phoneExtractWorkerQueue,
    limit: env.phoneExtractConcurrency,
    logPrefix: 'phone-extract',
    jobName: 'phone-extract-worker',
    jobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 30_000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
    buildJobs: async (capacity) => {
      const jobs = await buildPhoneExtractJobs(db, capacity);
      return jobs.map((j) => ({
        data: {
          accountId: j.accountId,
          platformUserId: j.platformUserId,
          platformId: j.platformId,
        },
        jobId: j.accountId,
      }));
    },
  });
}
