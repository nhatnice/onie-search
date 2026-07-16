import { FetchCrawlerAdapter, findFeedExtractor, type CrawlerAdapter } from '@/crawl';
import type { DiscoveredFeed } from '@/crawl/extractors/types';
import { isNotNoindex } from '@/crawl/policies/noindex';
import { isAllowedByRobots } from '@/crawl/policies/robots';
import { db } from '@/db/client';
import {
  getFeedsToScan,
  markFeedFailed,
  markFeedScanning,
} from '@/features/feed-sources/api/queries';
import { persistFeedDiscovery } from '@/features/feed-sources/api/services/feed-service';
import { inngest } from '@/inngest/client';
import {
  FEED_DISCOVERY_DISPATCHER_FUNCTION_ID,
  FEED_DISCOVERY_REQUESTED,
  FEED_DISCOVERY_WORKER_FUNCTION_ID,
  type FeedDiscoveryRequestedData,
} from '@/inngest/events';
import { canonicalizeUrl } from '@/lib/url';

const BATCH_SIZE = 100;
const WORKER_CONCURRENCY = Number(process.env.FEED_DISCOVERY_WORKER_CONCURRENCY) || 4;

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

export const feedDiscoveryDispatcher = inngest.createFunction(
  {
    id: FEED_DISCOVERY_DISPATCHER_FUNCTION_ID,
    triggers: [{ cron: '*/5 * * * *' }],
    retries: 3,
    // Backpressure: nếu run trước chưa xong, skip cron tick mới. Thay thế
    // `getBacklog() >= 200 -> skip` của BullMQ. Excess cron drops nhưng feeds
    // status=pending/failed sẽ được pickup ở tick sau (lastScannedAt chưa update).
    singleton: { mode: 'skip' },
  },
  async ({ step }) => {
    const due = await step.run('get-feeds-due', () => getFeedsToScan(db, BATCH_SIZE));
    if (due.length === 0) {
      console.warn('[feed-discovery] no feeds due');
      return { result: 'No feeds due' };
    }

    // Fan-out: 1 event per feed -> 1 child run per feed. step.sendEvent
    // durable + checkpointed, khác inngest.send fire-and-forget.
    await step.sendEvent(
      'dispatch-feeds',
      due.map((f) => ({
        name: FEED_DISCOVERY_REQUESTED,
        data: { feedId: f.id, url: f.url, type: f.type } satisfies FeedDiscoveryRequestedData,
      })),
    );
    console.warn(`[feed-discovery] dispatched ${due.length} feeds`);
    return { result: `Dispatched ${due.length} feeds` };
  },
);

function isFeedDiscoveryRequestedData(value: unknown): value is FeedDiscoveryRequestedData {
  return (
    typeof value === 'object' &&
    value !== null &&
    'feedId' in value &&
    'url' in value &&
    'type' in value &&
    typeof (value as { feedId: unknown }).feedId === 'string' &&
    typeof (value as { url: unknown }).url === 'string' &&
    ((value as { type: unknown }).type === 'sitemap' ||
      (value as { type: unknown }).type === 'rss' ||
      (value as { type: unknown }).type === 'atom' ||
      (value as { type: unknown }).type === 'json_feed')
  );
}

export const feedDiscoveryWorker = inngest.createFunction(
  {
    id: FEED_DISCOVERY_WORKER_FUNCTION_ID,
    triggers: [{ event: FEED_DISCOVERY_REQUESTED }],
    retries: 3,
    // Global concurrency cap. Excess events được Inngest queue (không drop).
    concurrency: { limit: WORKER_CONCURRENCY },
    // Dedup: mỗi feedId chỉ xử lý 1 lần (24h window). Thay jobId của BullMQ.
    idempotency: 'event.data.feedId',
  },
  async ({ event, step }) => {
    if (!isFeedDiscoveryRequestedData(event.data)) {
      throw new Error(`Invalid feed.discovery.requested payload: ${JSON.stringify(event.data)}`);
    }
    const { feedId, url, type } = event.data;
    const started = Date.now();
    console.warn(`[feed-discovery] start  url=${url} type=${type}`);

    await step.run('mark-scanning', () => markFeedScanning(db, feedId));

    try {
      const extracted = await step.run('fetch-and-extract', () => fetchAndExtract(url));
      const t2 = Date.now();
      const result = await step.run('persist', () =>
        persistFeedDiscovery(db, feedId, extracted, step),
      );
      console.warn(
        `[feed-discovery] saved    ${Date.now() - t2}ms pages=+${result.pagesAdded} feeds=+${result.feedsAdded} url=${url}`,
      );
      const ms = Date.now() - started;
      console.warn(`[feed-discovery] done   ${ms}ms url=${url}`);
      return { feedId, ...result };
    } catch (err) {
      await step.run('mark-failed', () => markFeedFailed(db, feedId).catch(() => undefined));
      console.error(`[feed-discovery] fail   url=${url}`, err);
      throw err;
    }
  },
);
