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
import {
  PAGE_CREATED,
  PAGE_CONTENT_CREATED,
  type PageCreatedData,
  type PageContentCreatedData,
} from '@/inngest/events';
import { R2ObjectStorage, uploadWithDedup, type ObjectStorage } from '@/storage';

import { extractPage } from '../extract';
import {
  insertSeedPages,
  markCrawled,
  markFailed,
  saveCrawlResult,
  type SaveCrawlArgs,
} from '../queries';
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
      const t0 = Date.now();
      const r = await getCrawler().crawl(url);
      console.warn(`[page-crawl] crawled ${Date.now() - t0}ms status=${r.statusCode} url=${url}`);
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
    const t1 = Date.now();
    const page = extractPage(result.document, result.rawHtml, r.url);
    console.warn(`[page-crawl] parsed   ${Date.now() - t1}ms url=${url}`);
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
    const t0 = Date.now();
    const result = await uploadWithDedup(
      getStorage(),
      db,
      `pages/${pid}/page/text.html`,
      Buffer.from(extracted.page.rawHtml, 'utf-8'),
      'text/html',
    );
    console.warn(`[page-crawl] uploaded ${Date.now() - t0}ms path=${result.path} url=${url}`);
    return result;
  });

  const saveResult = await step.run('save-page-contents', async () => {
    const t0 = Date.now();
    const args: SaveCrawlArgs = {
      pid,
      extracted: extracted.page,
      links: extracted.links,
      blob: upload,
    };
    const out = await saveCrawlResult(db, args);
    emitPageCreatedEvents(out.newPages);
    emitPageContentCreated({ pageId: pid, contentId: out.contentId, kind: 'page' });
    console.warn(`[page-crawl] saved    ${Date.now() - t0}ms url=${url}`);
    return { contentId: out.contentId };
  });

  return { pageId: pid, status: 'ok', contentId: saveResult.contentId };
}

export async function markPageFailed(db: DbOrTx, input: PageCrawlInput): Promise<void> {
  await markFailed(db, input.pageId).catch(() => undefined);
  console.error(`[page-crawl] exhausted retries, marked failed pageId=${input.pageId}`);
}

export async function seedPages(db: DbOrTx, urls: string[]): Promise<{ inserted: number }> {
  const rows = await insertSeedPages(db, urls);
  emitPageCreatedEvents(rows);
  return { inserted: rows.length };
}

function emitPageCreatedEvents(rows: ReadonlyArray<{ id: string; url: string }>): void {
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    name: PAGE_CREATED,
    data: { pageId: r.id, url: r.url } satisfies PageCreatedData,
  }));
  void inngest.send(payload).catch((err) => {
    console.error('[page-service] emit page.created failed', err);
  });
}

function emitPageContentCreated(data: PageContentCreatedData): void {
  void inngest
    .send({ name: PAGE_CONTENT_CREATED, data })
    .catch((err) => console.error('[page-service] emit page-content.created failed', err));
}
