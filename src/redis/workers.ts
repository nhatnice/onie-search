import { Worker, type Job, type ConnectionOptions } from 'bullmq';

import { FetchCrawlerAdapter, findFeedExtractor, type CrawlerAdapter } from '@/crawl';
import type { DiscoveredFeed } from '@/crawl/extractors/types';
import { isNotNoindex } from '@/crawl/policies/noindex';
import { isAllowedByRobots } from '@/crawl/policies/robots';
import { db } from '@/db/client';
import { eventEmitter, FEED_DISCOVERY_REQUESTED } from '@/events/emitter';
import type { FeedDiscoveryRequestedData } from '@/events/emitter';
import {
  getFeedsToScan,
  markFeedFailed,
  markFeedScanning,
} from '@/features/feed-sources/api/queries';
import { persistFeedDiscovery } from '@/features/feed-sources/api/services/feed-service';
import {
  crawlPage,
  markPageFailed,
  type PageCrawlInput,
} from '@/features/pages/api/services/page-service';
import { getCookieById } from '@/features/social/api/queries';
import { refreshCookie } from '@/features/social/api/services/cookie-service';
import {
  buildPhoneExtractJobs,
  extractPhone,
} from '@/features/social/api/services/phone-extract-service';
import {
  buildPostReactJobs,
  crawlPostReacts,
  failJob,
  finishJob,
  loadJobContext,
} from '@/features/social/api/services/post-react-service';
import { env } from '@/lib/env';
import { canonicalizeUrl } from '@/lib/url';

import { createRedisClient } from './client';
import { dispatchCapped } from './dispatch';
import { phoneExtractWorkerQueue, postReactCrawlQueue } from './queues';

const BATCH_SIZE = 100;

let fetcherInstance: CrawlerAdapter | undefined;

function getFetcher(): CrawlerAdapter {
  if (!fetcherInstance) fetcherInstance = new FetchCrawlerAdapter();
  return fetcherInstance;
}

function passFilter(url: string): boolean {
  return isAllowedByRobots(url) && isNotNoindex(url);
}

interface ExtractedFeeds {
  links: string[];
  feeds: DiscoveredFeed[];
}

async function fetchAndExtract(url: string): Promise<ExtractedFeeds> {
  const response = await getFetcher().crawl(url);
  const bodyText = response.body.toString('utf-8');
  const result = findFeedExtractor(response.contentType, bodyText).extractFeed(response);
  return {
    links: result.links
      .map((l) => canonicalizeUrl(l.url))
      .filter((u): u is string => Boolean(u))
      .filter(passFilter),
    feeds: result.feeds
      .map((f) => Object.assign(f, { url: canonicalizeUrl(f.url) ?? '' }))
      .filter((f) => f.url && passFilter(f.url)),
  };
}

// 1. page-crawl worker processor
async function pageCrawlProcessor(job: Job<PageCrawlInput>): Promise<unknown> {
  const { pageId, url } = job.data;
  try {
    return await crawlPage(db, { pageId, url });
  } catch (err) {
    if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
      await markPageFailed(db, { pageId, url }).catch(() => undefined);
    }
    throw err;
  }
}

// 2. feed-discovery-worker processor
async function feedDiscoveryWorkerProcessor(
  job: Job<FeedDiscoveryRequestedData>,
): Promise<unknown> {
  const { feedId, url } = job.data;
  const started = Date.now();

  await markFeedScanning(db, feedId);

  try {
    const extracted = await fetchAndExtract(url);
    const result = await persistFeedDiscovery(db, feedId, extracted);
    const ms = Date.now() - started;
    console.warn(
      `[feed-discovery] done ${ms}ms pages=+${result.pagesAdded} feeds=+${result.feedsAdded} url=${url}`,
    );
    return result;
  } catch (err) {
    if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
      await markFeedFailed(db, feedId).catch(() => undefined);
    }
    console.error(`[feed-discovery] fail url=${url}`, err);
    throw err;
  }
}

// 3. cookie-refresh-worker processor
async function cookieRefreshWorkerProcessor(
  job: Job<{ cookieId: string; accountId: string; platformId: string }>,
): Promise<unknown> {
  const { cookieId, platformId } = job.data;
  const started = Date.now();
  const cookie = await getCookieById(db, cookieId);
  if (!cookie) {
    console.warn(`[cookie-refresh] skip cookieId=${cookieId} (not found)`);
    return { result: 'Cookie not found' };
  }
  if (cookie.status === 'dead') {
    console.warn(`[cookie-refresh] skip cookieId=${cookieId} (dead)`);
    return { result: 'Cookie dead' };
  }
  const result = await refreshCookie(db, cookie, platformId);
  const ms = Date.now() - started;
  console.warn(
    `[cookie-refresh] ${result.status} ${ms}ms cookieId=${cookieId} platform=${platformId}`,
  );
  return result;
}

// 4. post-react-crawl processor (platform-agnostic — delegates to adapter via registry)
interface PostReactCrawlJobData {
  jobId: string;
  postId: string;
  postUrl: string;
  platformId: string;
  cookieId: string;
}

async function postReactCrawlProcessor(job: Job<PostReactCrawlJobData>): Promise<unknown> {
  const { jobId, postId, postUrl, platformId, cookieId } = job.data;
  const started = Date.now();
  try {
    const context = await loadJobContext(db, jobId);
    const startCursor = context?.startCursor ?? null;
    const result = await crawlPostReacts(db, {
      jobId,
      postId,
      postUrl,
      platformId,
      cookieId,
      startCursor,
    });
    await finishJob(db, jobId, result);
    const ms = Date.now() - started;
    console.warn(
      `[post-react] done ${ms}ms postId=${postId} reactors=+${result.reactors} platform=${platformId}`,
    );
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (job.attemptsMade + 1 >= (job.opts.attempts || 1)) {
      await failJob(db, jobId, msg).catch(() => undefined);
    }
    console.error(`[post-react] fail postId=${postId} jobId=${jobId}`, err);
    throw err;
  }
}

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

export { BATCH_SIZE };

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

import type Redis from 'ioredis';

// 5. phone-extract-worker processor
interface PhoneExtractJobData {
  accountId: string;
  platformUserId: string;
  platformId: string;
}

async function phoneExtractProcessor(job: Job<PhoneExtractJobData>): Promise<unknown> {
  const { accountId, platformUserId, platformId } = job.data;
  const started = Date.now();
  try {
    await extractPhone(db, accountId, platformId, platformUserId);
    const ms = Date.now() - started;
    console.warn(`[phone-extract] done ${ms}ms accountId=${accountId} platform=${platformId}`);
    return { accountId, platformId };
  } catch (err) {
    const ms = Date.now() - started;
    console.error(
      `[phone-extract] fail ${ms}ms accountId=${accountId}`,
      err instanceof Error ? err.message : String(err),
    );
    throw err;
  }
}

let pageCrawlWorker: Worker | undefined;
let feedDiscoveryWorker: Worker | undefined;
let cookieRefreshWorker: Worker | undefined;
let postReactCrawlWorker: Worker | undefined;
let phoneExtractWorker: Worker | undefined;

let pageCrawlConn: Redis | undefined;
let feedDiscoveryConn: Redis | undefined;
let cookieRefreshConn: Redis | undefined;
let postReactCrawlConn: Redis | undefined;
let phoneExtractConn: Redis | undefined;

export function startWorkers(): void {
  const pageCrawlConcurrency = env.pageCrawlConcurrency;
  const workerConcurrency = env.feedDiscoveryConcurrency;
  const cookieRefreshWorkerConcurrency = env.cookieRefreshConcurrency;
  const postReactCrawlConcurrency = env.postReactCrawlConcurrency;
  const phoneExtractConcurrency = env.phoneExtractConcurrency;

  pageCrawlConn = createRedisClient();
  pageCrawlWorker = new Worker('page-crawl', pageCrawlProcessor, {
    connection: pageCrawlConn as unknown as ConnectionOptions,
    concurrency: pageCrawlConcurrency,
  });

  feedDiscoveryConn = createRedisClient();
  feedDiscoveryWorker = new Worker('feed-discovery-worker', feedDiscoveryWorkerProcessor, {
    connection: feedDiscoveryConn as unknown as ConnectionOptions,
    concurrency: workerConcurrency,
  });

  cookieRefreshConn = createRedisClient();
  cookieRefreshWorker = new Worker('cookie-refresh-worker', cookieRefreshWorkerProcessor, {
    connection: cookieRefreshConn as unknown as ConnectionOptions,
    concurrency: cookieRefreshWorkerConcurrency,
  });

  postReactCrawlConn = createRedisClient();
  postReactCrawlWorker = new Worker('post-react-crawl', postReactCrawlProcessor, {
    connection: postReactCrawlConn as unknown as ConnectionOptions,
    concurrency: postReactCrawlConcurrency,
  });

  phoneExtractConn = createRedisClient();
  phoneExtractWorker = new Worker('phone-extract-worker', phoneExtractProcessor, {
    connection: phoneExtractConn as unknown as ConnectionOptions,
    concurrency: phoneExtractConcurrency,
  });

  console.warn('[BullMQ] Workers started successfully');
}

export async function stopWorkers(): Promise<void> {
  console.warn('[BullMQ] Stopping workers...');
  const promises: Promise<void>[] = [];
  if (pageCrawlWorker) {
    promises.push(pageCrawlWorker.close());
  }
  if (feedDiscoveryWorker) {
    promises.push(feedDiscoveryWorker.close());
  }
  if (cookieRefreshWorker) {
    promises.push(cookieRefreshWorker.close());
  }
  if (postReactCrawlWorker) {
    promises.push(postReactCrawlWorker.close());
  }
  if (phoneExtractWorker) {
    promises.push(phoneExtractWorker.close());
  }
  await Promise.all(promises);

  if (pageCrawlConn) {
    await pageCrawlConn.quit();
  }
  if (feedDiscoveryConn) {
    await feedDiscoveryConn.quit();
  }
  if (cookieRefreshConn) {
    await cookieRefreshConn.quit();
  }
  if (postReactCrawlConn) {
    await postReactCrawlConn.quit();
  }
  if (phoneExtractConn) {
    await phoneExtractConn.quit();
  }

  console.warn('[BullMQ] Workers stopped');
}
