import { eq } from 'drizzle-orm';
import type { GetStepTools, Inngest } from 'inngest';

import type { CrawlResponse } from '@/crawl';
import {
  CompositeCrawlerAdapter,
  extractFeedLinks,
  findPageExtractor,
  type CrawlerAdapter,
} from '@/crawl';
import type { DbOrTx } from '@/db/types';
import { insertFeedLinks } from '@/features/feed-sources/api/services/feed-service';
import { inngest } from '@/inngest/client';
import { PAGE_CONTENT_CREATED, PAGE_CREATED, type PageCreatedData } from '@/inngest/events';
import { R2ObjectStorage, uploadWithDedup, type ObjectStorage } from '@/storage';

import { extractPage } from '../extract';
import { insertSeedPages, markCrawled, markFailed, saveCrawlResult } from '../queries';
import { pages } from '../schema';
import type { CrawlableLink } from '../types';

type Step = GetStepTools<Inngest.Any>;

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

export async function crawlPage(
  db: DbOrTx,
  input: PageCrawlInput,
  step: Step,
): Promise<PageCrawlResult> {
  const { pageId: pid, url } = input;

  await step.run('mark-crawling', async () => {
    await db
      .update(pages)
      .set({ status: 'crawling', updatedAt: new Date() })
      .where(eq(pages.id, pid));
  });

  let response: { statusCode: number; contentType: string; url: string; body: string };
  try {
    response = await step.run('crawl', async () => {
      const r = await getCrawler().crawl(url);
      return {
        statusCode: r.statusCode,
        contentType: r.contentType,
        url: r.url,
        body: r.body.toString('utf-8'),
      };
    });
  } catch (err) {
    await markFailed(db, pid).catch(() => undefined);
    console.error(`[page-crawl] crawl step failed url=${url}`, err);
    return { pageId: pid, status: 'failed' };
  }

  const isHtml = await step.run('detect-html', async () => {
    return findPageExtractor(response.contentType).name === 'html';
  });

  if (!isHtml) {
    await step.run('mark-crawled-no-content', async () => {
      await markCrawled(db, pid);
    });
    return { pageId: pid, status: 'no-content' };
  }

  const extracted = await step.run('extract', async () => {
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
    return { page, links: allLinks, feedLinks };
  });

  await step.run('insert-feed-links', async () => {
    if (extracted.feedLinks.length > 0) {
      await insertFeedLinks(db, extracted.feedLinks);
    }
  });

  const upload = await step.run('upload-r2', async () => {
    return uploadWithDedup(
      getStorage(),
      db,
      `pages/${pid}/page/text.html`,
      Buffer.from(extracted.page.rawHtml, 'utf-8'),
      'text/html',
    );
  });

  const saveResult = await step.run('save-page-contents', async () => {
    const out = await saveCrawlResult(db, {
      pid,
      extracted: extracted.page,
      links: extracted.links,
      blob: upload,
    });
    return { contentId: out.contentId, newPages: out.newPages };
  });

  // Durable event emission inside the function: step.sendEvent is checkpointed
  // by Inngest so events survive process crashes between DB commit and send.
  await step.sendEvent('emit-page-created', {
    name: PAGE_CREATED,
    data: { pageId: pid, url },
  });
  if (saveResult.newPages.length > 0) {
    await step.sendEvent(
      'emit-new-pages',
      saveResult.newPages.map((r) => ({
        name: PAGE_CREATED,
        data: { pageId: r.id, url: r.url } satisfies PageCreatedData,
      })),
    );
  }
  await step.sendEvent('emit-page-content-created', {
    name: PAGE_CONTENT_CREATED,
    data: { pageId: pid, contentId: saveResult.contentId, kind: 'page' as const },
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
  const payload = rows.map((r) => ({
    name: PAGE_CREATED,
    data: { pageId: r.id, url: r.url } satisfies PageCreatedData,
  }));
  void inngest.send(payload).catch((err) => {
    console.error('[page-service] emit seed page.created failed', err);
  });
}
