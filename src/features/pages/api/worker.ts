import { Worker, type Job } from 'bullmq';

import {
  createSilentJSDOM,
  findPageExtractor,
  PlaywrightCrawlerAdapter,
  type CrawlerAdapter,
} from '@/crawl';
import { db } from '@/db/client';
import type { DbOrTx } from '@/db/types';
import { env } from '@/lib/env';
import { pageId } from '@/lib/url';
import { getRedisConnection } from '@/redis/client';

import { extractPage } from './extract';
import { getPagesByIds, markCrawled, markFailed, saveCrawlResult } from './queries';
import { ensurePageCrawlQueue, PAGE_CRAWL_QUEUE, type PageCrawlJobData } from './queue';
import type { CrawlableLink } from './types';

const WORKER_CONCURRENCY = Number(process.env.PAGE_CRAWL_WORKER_CONCURRENCY) || 2;

let workerInstance: Worker<PageCrawlJobData> | undefined;
let crawlerInstance: CrawlerAdapter | undefined;

function getCrawler(): CrawlerAdapter {
  if (!crawlerInstance) crawlerInstance = new PlaywrightCrawlerAdapter({ headless: true });
  return crawlerInstance;
}

async function processJob(job: Job<PageCrawlJobData>) {
  const { pageId: pid, url, crawlDepth } = job.data;
  const started = Date.now();
  console.warn(`[page-crawl] start  depth=${crawlDepth} url=${url}`);
  const crawler = getCrawler();
  try {
    const t0 = Date.now();
    const response = await crawler.crawl(url);
    const crawlMs = Date.now() - t0;
    console.warn(`[page-crawl] crawled ${crawlMs}ms status=${response.statusCode} url=${url}`);

    const t1 = Date.now();
    const extractor = findPageExtractor(response.contentType);
    const { html, links, sitemapUrls } = extractor.extract(response);
    const extractMs = Date.now() - t1;
    console.warn(
      `[page-crawl] extracted ${extractMs}ms links=${links.length} sitemaps=${sitemapUrls.length} url=${url}`,
    );

    if (html) {
      const t2 = Date.now();
      const dom = createSilentJSDOM(html, { url: response.url });
      const page = extractPage(dom.window.document, html, response.url);
      const parseMs = Date.now() - t2;
      console.warn(
        `[page-crawl] parsed   ${parseMs}ms markdown=${page.rawMarkdown?.length ?? 0}ch url=${url}`,
      );

      const t3 = Date.now();
      const crawlableLinks: CrawlableLink[] = links.map((l) => ({ url: l.url, type: l.type }));
      const { toEnqueue } = await saveCrawlResult(db, {
        pid,
        extracted: page,
        links: crawlableLinks,
      });
      const saveMs = Date.now() - t3;
      console.warn(`[page-crawl] saved    ${saveMs}ms enqueue=${toEnqueue.length} url=${url}`);

      await enqueueFreshPages(db, toEnqueue, crawlDepth + 1);
    } else {
      await markCrawled(db, pid);
    }

    if (sitemapUrls.length > 0) {
      try {
        await ensurePageCrawlQueue().addBulk(
          sitemapUrls.map((u) => ({
            name: 'page-crawl',
            data: { pageId: pageId(u), url: u, crawlDepth: crawlDepth + 1 },
            opts: { jobId: pageId(u) },
          })),
        );
      } catch (err) {
        console.error('[page-crawl] sitemap enqueue failed', err);
      }
    }

    const ms = Date.now() - started;
    console.warn(`[page-crawl] done   depth=${crawlDepth} ${ms}ms url=${url}`);
    return { pageId: pid, links: links.length, sitemapUrls: sitemapUrls.length };
  } catch (err) {
    await markFailed(db, pid).catch(() => undefined);
    console.error(`[page-crawl] fail   depth=${crawlDepth} url=${url}`, err);
    throw err;
  }
}

/** Enqueue pages that are missing or still pending — skip already-crawled. */
async function enqueueFreshPages(
  dbOrTx: DbOrTx,
  candidates: ReadonlyArray<{ id: string; url: string }>,
  nextDepth: number,
): Promise<void> {
  if (candidates.length === 0) return;
  const existingRows = await getPagesByIds(
    dbOrTx,
    candidates.map((c) => c.id),
  );
  const existingById = new Map(existingRows.map((r) => [r.id, r]));
  const fresh = candidates.filter((c) => {
    const existing = existingById.get(c.id);
    return !existing || existing.status === 'pending' || existing.status === 'failed';
  });
  if (fresh.length === 0) {
    console.warn(
      `[page-crawl] enqueue depth=${nextDepth} all ${candidates.length} candidates already crawled`,
    );
    return;
  }
  try {
    await ensurePageCrawlQueue().addBulk(
      fresh.map((p) => ({
        name: 'page-crawl',
        data: { pageId: p.id, url: p.url, crawlDepth: nextDepth },
        opts: { jobId: p.id },
      })),
    );
    console.warn(`[page-crawl] enqueued ${fresh.length} pages depth=${nextDepth}`);
  } catch (err) {
    console.error('[page-crawl] link enqueue failed', err);
  }
}

export function ensurePageCrawlWorker(): Worker<PageCrawlJobData> {
  if (workerInstance) return workerInstance;
  const conn = getRedisConnection();
  console.warn(
    `[page-crawl] redis status=${conn.status} url=${env.redisUrl.replace(/:[^:@]+@/, ':***@')}`,
  );
  workerInstance = new Worker<PageCrawlJobData>(PAGE_CRAWL_QUEUE, processJob, {
    connection: conn,
    concurrency: WORKER_CONCURRENCY,
  });
  workerInstance.on('ready', () => {
    console.warn('[page-crawl] worker ready, polling for jobs...');
  });
  workerInstance.on('failed', async (job, err) => {
    if (!job) return;
    console.error(`[page-crawl] job ${job.id} failed url=${job.data.url}`, err);
  });
  workerInstance.on('error', (err) => {
    console.error('[page-crawl] worker error', err);
  });
  console.warn('[page-crawl] worker started, waiting for jobs...');
  return workerInstance;
}

export async function shutdownPageCrawlWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = undefined;
    console.warn('[page-crawl] worker stopped');
  }
  if (crawlerInstance) {
    await crawlerInstance.close();
    crawlerInstance = undefined;
  }
}
