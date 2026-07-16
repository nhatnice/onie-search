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

export const feedDiscoveryDispatcher = inngest.createFunction(
  {
    id: FEED_DISCOVERY_DISPATCHER_FUNCTION_ID,
    triggers: [{ cron: '*/5 * * * *' }],
    retries: 3,
    singleton: { mode: 'skip' },
  },
  async ({ step }) => {
    const due = await step.run('get-feeds-due', () => getFeedsToScan(db, BATCH_SIZE));
    if (due.length === 0) return { result: 'No feeds due' };

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
    concurrency: { limit: WORKER_CONCURRENCY },
    idempotency: 'event.data.feedId',
  },
  async ({ event, step }) => {
    if (!isFeedDiscoveryRequestedData(event.data)) {
      throw new Error(`Invalid feed.discovery.requested payload: ${JSON.stringify(event.data)}`);
    }
    const { feedId, url } = event.data;
    const started = Date.now();

    await step.run('mark-scanning', () => markFeedScanning(db, feedId));

    try {
      const result = await step.run('fetch-extract-persist', async () => {
        const extracted = await fetchAndExtract(url);
        return persistFeedDiscovery(db, feedId, extracted);
      });
      const ms = Date.now() - started;
      console.warn(
        `[feed-discovery] done ${ms}ms pages=+${result.pagesAdded} feeds=+${result.feedsAdded} url=${url}`,
      );
      return { feedId, ...result };
    } catch (err) {
      await step.run('mark-failed', () => markFeedFailed(db, feedId).catch(() => undefined));
      console.error(`[feed-discovery] fail url=${url}`, err);
      throw err;
    }
  },
);
