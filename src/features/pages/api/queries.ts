import { createHash } from 'node:crypto';

import { and, asc, eq, inArray, isNull, type SQL } from 'drizzle-orm';

import type { DbOrTx } from '@/db/types';
import { pageId } from '@/lib/url';

import { pageContents, pageLinks, pageMetadata, pages } from './schema';
import type { CrawlableLink, ExtractedPage } from './types';

function notDeleted(): SQL {
  return isNull(pages.deletedAt);
}

function linkRecordId(sourcePageId: string, targetPageId: string, linkType: string): string {
  return createHash('sha1').update(`${sourcePageId}|${targetPageId}|${linkType}`).digest('hex');
}

export async function getPendingPages(db: DbOrTx, limit: number) {
  return db
    .select()
    .from(pages)
    .where(and(inArray(pages.status, ['pending', 'failed']), notDeleted()))
    .orderBy(asc(pages.status), asc(pages.updatedAt))
    .limit(limit);
}

export async function getPageById(db: DbOrTx, id: string) {
  const [row] = await db.select().from(pages).where(eq(pages.id, id)).limit(1);
  return row;
}

export async function getPagesByIds(db: DbOrTx, ids: readonly string[]) {
  if (ids.length === 0) return [];
  return db.select().from(pages).where(inArray(pages.id, ids));
}

export async function markCrawled(db: DbOrTx, pid: string) {
  const now = new Date();
  await db
    .update(pages)
    .set({ status: 'crawled', crawledAt: now, updatedAt: now })
    .where(eq(pages.id, pid));
}

export async function markFailed(db: DbOrTx, pid: string) {
  await db.update(pages).set({ status: 'failed', updatedAt: new Date() }).where(eq(pages.id, pid));
}

export async function insertSeedPages(db: DbOrTx, urls: string[]): Promise<number> {
  if (urls.length === 0) return 0;
  const rows = urls.map((url) => ({ id: pageId(url), url, status: 'pending' as const }));
  const inserted = await db
    .insert(pages)
    .values(rows)
    .onConflictDoNothing()
    .returning({ id: pages.id });
  return inserted.length;
}

export interface SaveCrawlArgs {
  pid: string;
  extracted: ExtractedPage;
  links: readonly CrawlableLink[];
}

export async function saveCrawlResult(db: DbOrTx, args: SaveCrawlArgs): Promise<void> {
  const { pid, extracted, links } = args;
  const now = new Date();
  const metaSet = {
    title: extracted.title,
    description: extracted.description,
    thumbnail: extracted.thumbnail,
    favicon: extracted.favicon,
    jsonLd: extracted.jsonLd,
    language: extracted.language,
    author: extracted.author,
    publishedAt: extracted.publishedAt,
    modifiedAt: extracted.modifiedAt,
    updatedAt: now,
  };

  const edges = links.map((l) => {
    const targetId = pageId(l.url);
    return {
      id: linkRecordId(pid, targetId, l.type),
      targetPageId: targetId,
      linkType: l.type,
    };
  });
  const targetPageRows = links.map((l) => ({
    id: pageId(l.url),
    url: l.url,
    status: 'pending' as const,
  }));

  await db.transaction(async (tx) => {
    await markCrawling(tx, pid, now);
    await upsertMetadata(tx, pid, metaSet);
    await upsertContent(tx, pid, extracted, now);
    await insertTargetPages(tx, targetPageRows);
    await insertEdges(tx, edges, pid);
    await markCrawledTx(tx, pid, now);
  });
}

function markCrawling(tx: DbOrTx, pid: string, now: Date) {
  return tx.update(pages).set({ status: 'crawling', updatedAt: now }).where(eq(pages.id, pid));
}

function upsertMetadata(
  tx: DbOrTx,
  pid: string,
  metaSet: {
    title: string | undefined;
    description: string | undefined;
    thumbnail: string | undefined;
    favicon: string | undefined;
    jsonLd: unknown[];
    language: string | undefined;
    author: string | undefined;
    publishedAt: string | undefined;
    modifiedAt: string | undefined;
    updatedAt: Date;
  },
) {
  return tx
    .insert(pageMetadata)
    .values({ pageId: pid, ...metaSet })
    .onConflictDoUpdate({
      target: pageMetadata.pageId,
      set: metaSet,
    });
}

function upsertContent(tx: DbOrTx, pid: string, extracted: ExtractedPage, now: Date) {
  return tx
    .insert(pageContents)
    .values({
      pageId: pid,
      rawMarkdown: extracted.rawMarkdown,
      cleanMarkdown: extracted.cleanMarkdown,
      cleanHtml: extracted.cleanHtml,
      rawHtml: extracted.rawHtml,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pageContents.pageId,
      set: {
        rawMarkdown: extracted.rawMarkdown,
        cleanMarkdown: extracted.cleanMarkdown,
        cleanHtml: extracted.cleanHtml,
        rawHtml: extracted.rawHtml,
        updatedAt: now,
      },
    });
}

function insertTargetPages(
  tx: DbOrTx,
  rows: Array<{ id: string; url: string; status: 'pending' }>,
) {
  if (rows.length === 0) return Promise.resolve();
  return tx.insert(pages).values(rows).onConflictDoNothing();
}

function insertEdges(
  tx: DbOrTx,
  edges: Array<{ id: string; targetPageId: string; linkType: CrawlableLink['type'] }>,
  pid: string,
) {
  if (edges.length === 0) return Promise.resolve();
  return tx
    .insert(pageLinks)
    .values(
      edges.map((e) => ({
        id: e.id,
        sourcePageId: pid,
        targetPageId: e.targetPageId,
        linkType: e.linkType,
      })),
    )
    .onConflictDoNothing();
}

function markCrawledTx(tx: DbOrTx, pid: string, now: Date) {
  return tx
    .update(pages)
    .set({ status: 'crawled', crawledAt: now, updatedAt: now })
    .where(eq(pages.id, pid));
}
