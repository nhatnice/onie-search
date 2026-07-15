import { Worker, type Job } from 'bullmq';

import {
  FetchCrawlerAdapter,
  findFeedExtractor,
  type CrawlerAdapter,
  type DiscoveredFeed,
} from '@/crawl';
import { isNotNoindex } from '@/crawl/policies/noindex';
import { isAllowedByRobots } from '@/crawl/policies/robots';
import { getDefaultDb } from '@/features/feed-sources/api/queries';
import { canonicalizeUrl } from '@/lib/url';
import { getRedisConnection } from '@/redis/client';

import {
  insertDiscoveredPages,
  insertFeeds,
  markFeedFailed,
  markFeedScanned,
  markFeedScanning,
} from './queries';
import { FEED_DISCOVERY_QUEUE, type FeedDiscoveryJobData } from './queue';

const WORKER_CONCURRENCY = Number(process.env.FEED_DISCOVERY_WORKER_CONCURRENCY) || 4;

let workerInstance: Worker<FeedDiscoveryJobData> | undefined;
let fetcherInstance: CrawlerAdapter | undefined;

function getFetcher(): CrawlerAdapter {
  if (!fetcherInstance) fetcherInstance = new FetchCrawlerAdapter();
  return fetcherInstance;
}

function passFilter(url: string): boolean {
  return isAllowedByRobots(url) && isNotNoindex(url);
}

interface FeedDiscoveryResult {
  pagesAdded: number;
  feedsAdded: number;
}

interface ExtractedFeeds {
  links: string[];
  feeds: DiscoveredFeed[];
}

async function fetchAndExtract(url: string): Promise<ExtractedFeeds> {
  const t0 = Date.now();
  const response = await getFetcher().crawl(url);
  console.warn(
    `[feed-discovery] fetched ${Date.now() - t0}ms status=${response.statusCode} type=${response.contentType} url=${url}`,
  );

  const t1 = Date.now();
  const result = findFeedExtractor(response.contentType).extractFeed(response);
  console.warn(
    `[feed-discovery] extracted ${Date.now() - t1}ms links=${result.links.length} feeds=${result.feeds.length} url=${url}`,
  );

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

async function persist(
  db: ReturnType<typeof getDefaultDb>,
  feedId: string,
  extracted: ExtractedFeeds,
): Promise<FeedDiscoveryResult> {
  const t2 = Date.now();
  const [pagesAdded, feedsAdded] = await Promise.all([
    insertDiscoveredPages(db, extracted.links),
    insertFeeds(db, extracted.feeds),
  ]);
  console.warn(
    `[feed-discovery] saved    ${Date.now() - t2}ms pages=+${pagesAdded} feeds=+${feedsAdded} url`,
  );
  await markFeedScanned(db, feedId);
  return { pagesAdded, feedsAdded };
}

async function processJob(
  job: Job<FeedDiscoveryJobData>,
): Promise<FeedDiscoveryResult & { feedId: string }> {
  const { feedId: fid, url } = job.data;
  const started = Date.now();
  const db = getDefaultDb();
  console.warn(`[feed-discovery] start  url=${url}`);
  await markFeedScanning(db, fid);
  try {
    const extracted = await fetchAndExtract(url);
    const result = await persist(db, fid, extracted);
    const ms = Date.now() - started;
    console.warn(`[feed-discovery] done   ${ms}ms url=${url}`);
    return { feedId: fid, ...result };
  } catch (err) {
    await markFeedFailed(db, fid).catch(() => undefined);
    console.error(`[feed-discovery] fail   url=${url}`, err);
    throw err;
  }
}

export function ensureFeedDiscoveryWorker(): Worker<FeedDiscoveryJobData> {
  if (workerInstance) return workerInstance;
  const conn = getRedisConnection();
  workerInstance = new Worker<FeedDiscoveryJobData>(FEED_DISCOVERY_QUEUE, processJob, {
    connection: conn,
    concurrency: WORKER_CONCURRENCY,
    // ponytail: jobTimeout via lockDuration. External feed fetch can be slow;
    // stalled job moves back to waiting + retries. maxStalledCount caps infinite stall loop.
    lockDuration: 60_000,
    maxStalledCount: 1,
  });
  workerInstance.on('ready', () => {
    console.warn('[feed-discovery] worker ready, polling for jobs...');
  });
  workerInstance.on('failed', async (job, err) => {
    if (!job) return;
    console.error(`[feed-discovery] job ${job.id} failed url=${job.data.url}`, err);
  });
  workerInstance.on('error', (err) => {
    console.error('[feed-discovery] worker error', err);
  });
  console.warn('[feed-discovery] worker started, waiting for jobs...');
  return workerInstance;
}

export async function shutdownFeedDiscoveryWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = undefined;
    console.warn('[feed-discovery] worker stopped');
  }
  if (fetcherInstance) {
    await fetcherInstance.close();
    fetcherInstance = undefined;
  }
}
