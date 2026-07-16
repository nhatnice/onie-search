import { eq } from 'drizzle-orm';

import type { CrawlResponse } from '@/crawl';
import {
  CompositeCrawlerAdapter,
  extractFeedLinks,
  findPageExtractor,
  type CrawlerAdapter,
} from '@/crawl';
import type { DbOrTx } from '@/db/types';
import { eventEmitter, PAGE_CONTENT_CREATED, PAGE_CREATED } from '@/events/emitter';
import { insertFeedLinks } from '@/features/feed-sources/api/services/feed-service';
import { R2ObjectStorage, uploadWithDedup, type ObjectStorage } from '@/storage';

import { extractPage } from '../extract';
import { insertSeedPages, markCrawled, markFailed, saveCrawlResult } from '../queries';
import { pages } from '../schema';
import type { CrawlableLink } from '../types';

let crawlerInstance: CrawlerAdapter | undefined;
let storageInstance: ObjectStorage | undefined;

function getCrawler(): CrawlerAdapter {
  if (!crawlerInstance) crawlerInstance = new CompositeCrawlerAdapter();
  return crawlerInstance;
}

function getStorage(): ObjectStorage {
  if (!storageInstance) storageInstance = new R2ObjectStorage();
  return storageInstance;
}

export interface PageCrawlInput {
  pageId: string;
  url: string;
}

export type PageCrawlResult =
  | { pageId: string; status: 'ok'; contentId: string }
  | { pageId: string; status: 'no-content' }
  | { pageId: string; status: 'failed' };

export async function crawlPage(db: DbOrTx, input: PageCrawlInput): Promise<PageCrawlResult> {
  const { pageId: pid, url } = input;

  await db
    .update(pages)
    .set({ status: 'crawling', updatedAt: new Date() })
    .where(eq(pages.id, pid));

  let response: { statusCode: number; contentType: string; url: string; body: string };
  try {
    const r = await getCrawler().crawl(url);
    response = {
      statusCode: r.statusCode,
      contentType: r.contentType,
      url: r.url,
      body: r.body.toString('utf-8'),
    };
  } catch (err) {
    await markFailed(db, pid).catch(() => undefined);
    console.error(`[page-crawl] crawl step failed url=${url}`, err);
    return { pageId: pid, status: 'failed' };
  }

  const isHtml = findPageExtractor(response.contentType).name === 'html';

  if (!isHtml) {
    await markCrawled(db, pid);
    return { pageId: pid, status: 'no-content' };
  }

  const r: CrawlResponse = {
    url: response.url,
    statusCode: response.statusCode,
    contentType: response.contentType,
    body: Buffer.from(response.body, 'utf-8'),
    headers: {},
    durationMs: 0,
  };
  const extractor = findPageExtractor(r.contentType);
  const result = extractor.extractPage(r);
  const page = extractPage(result.document, result.rawHtml, r.url);
  const allLinks: CrawlableLink[] = [
    ...result.links,
    ...result.feeds
      .filter((f) => f.type === 'sitemap')
      .map((f) => ({ url: f.url, type: 'sitemap' as const })),
  ];
  const feedLinks = extractFeedLinks(result.document, r.url);

  if (feedLinks.length > 0) {
    await insertFeedLinks(db, feedLinks);
  }

  const upload = await uploadWithDedup(
    getStorage(),
    db,
    `pages/${pid}/page/text.html`,
    Buffer.from(page.rawHtml, 'utf-8'),
    'text/html',
  );

  const saveResult = await saveCrawlResult(db, {
    pid,
    extracted: page,
    links: allLinks,
    blob: upload,
  });

  // Emit event via eventEmitter instead of step.sendEvent
  eventEmitter.emit(PAGE_CREATED, { pageId: pid, url });
  if (saveResult.newPages.length > 0) {
    for (const p of saveResult.newPages) {
      eventEmitter.emit(PAGE_CREATED, { pageId: p.id, url: p.url });
    }
  }
  eventEmitter.emit(PAGE_CONTENT_CREATED, {
    pageId: pid,
    contentId: saveResult.contentId,
    kind: 'page' as const,
  });

  return { pageId: pid, status: 'ok', contentId: saveResult.contentId };
}

export async function markPageFailed(db: DbOrTx, input: PageCrawlInput): Promise<void> {
  await markFailed(db, input.pageId).catch(() => undefined);
  console.error(`[page-crawl] exhausted retries, marked failed pageId=${input.pageId}`);
}

export async function seedPages(db: DbOrTx, urls: string[]): Promise<{ inserted: number }> {
  const rows = await insertSeedPages(db, urls);
  // Called from Nitro task (no Inngest step available). Fire-and-forget is OK
  // here — seed is a rare manual path; if event lost, re-run db:seed.
  emitSeedPageCreatedFireForget(rows);
  return { inserted: rows.length };
}

// Cross-feature public API: feed-sources worker uses this to insert pages
// discovered from sitemaps. Does NOT emit PAGE_CREATED — caller (worker)
// emits via step.sendEvent in the outer Inngest function so events are
// checkpointed and retry-safe.
export async function insertDiscoveredPages(db: DbOrTx, urls: readonly string[]): Promise<number> {
  if (urls.length === 0) return 0;
  const rows = await insertSeedPages(db, [...urls]);
  return rows.length;
}

function emitSeedPageCreatedFireForget(rows: ReadonlyArray<{ id: string; url: string }>): void {
  if (rows.length === 0) return;
  for (const r of rows) {
    eventEmitter.emit(PAGE_CREATED, { pageId: r.id, url: r.url });
  }
}
