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
import { canonicalizeUrl } from '@/lib/url';

import { createRedisClient } from './client';
import { feedDiscoveryDispatcherQueue } from './queues';

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

// 3. feed-discovery-dispatcher processor
const BATCH_SIZE = 100;
async function feedDiscoveryDispatcherProcessor(): Promise<unknown> {
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

let pageCrawlWorker: Worker | undefined;
let feedDiscoveryWorker: Worker | undefined;
let feedDiscoveryDispatcherWorker: Worker | undefined;

export function startWorkers(): void {
  const pageCrawlConcurrency = Number(process.env.PAGE_CRAWL_CONCURRENCY) || 50;
  const workerConcurrency = Number(process.env.FEED_DISCOVERY_WORKER_CONCURRENCY) || 4;

  pageCrawlWorker = new Worker('page-crawl', pageCrawlProcessor, {
    connection: createRedisClient() as unknown as ConnectionOptions,
    concurrency: pageCrawlConcurrency,
  });

  feedDiscoveryWorker = new Worker('feed-discovery-worker', feedDiscoveryWorkerProcessor, {
    connection: createRedisClient() as unknown as ConnectionOptions,
    concurrency: workerConcurrency,
  });

  feedDiscoveryDispatcherWorker = new Worker(
    'feed-discovery-dispatcher',
    feedDiscoveryDispatcherProcessor,
    {
      connection: createRedisClient() as unknown as ConnectionOptions,
      concurrency: 1,
    },
  );

  console.warn('[BullMQ] Workers started successfully');
}

export async function setupRepeatableJobs(): Promise<void> {
  // Add repeatable job for feed discovery dispatcher
  await feedDiscoveryDispatcherQueue.add(
    'dispatch-feeds',
    {},
    {
      repeat: {
        pattern: '*/5 * * * *',
      },
      jobId: 'feed-discovery-dispatcher-repeat',
      removeOnComplete: true,
      removeOnFail: true,
    },
  );
  console.warn('[BullMQ] Scheduled repeatable feed discovery dispatcher');
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
  if (feedDiscoveryDispatcherWorker) {
    promises.push(feedDiscoveryDispatcherWorker.close());
  }
  await Promise.all(promises);
  console.warn('[BullMQ] Workers stopped');
}
