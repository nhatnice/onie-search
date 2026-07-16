import { createHash } from 'node:crypto';

import { and, asc, eq, inArray, isNull, type SQL } from 'drizzle-orm';

import { insertBulk } from '@/db';
import type { DbOrTx } from '@/db/types';
import { pageId } from '@/lib/url';
import type { UploadResult } from '@/storage';

import { pageContents, pageLinks, pageMetadata, pages } from './schema';
import type { CrawlableLink, ExtractedPage } from './types';

function notDeleted(): SQL {
  return isNull(pages.deletedAt);
}

function linkRecordId(sourcePageId: string, targetPageId: string, linkType: string): string {
  return createHash('sha1').update(`${sourcePageId}|${targetPageId}|${linkType}`).digest('hex');
}

function contentId(pageIdValue: string, kind: 'page' | 'media' | 'file', mimeType: string): string {
  return createHash('sha1').update(`${pageIdValue}|${kind}|${mimeType}`).digest('hex');
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

export async function insertSeedPages(
  db: DbOrTx,
  urls: string[],
): Promise<Array<{ id: string; url: string }>> {
  if (urls.length === 0) return [];
  const rows = urls.map((url) => ({ id: pageId(url), url, status: 'pending' as const }));
  return insertBulk(db, pages, rows, (t) => ({ id: t.id, url: t.url }));
}

export interface SaveCrawlArgs {
  pid: string;
  extracted: ExtractedPage;
  links: readonly CrawlableLink[];
  blob: UploadResult;
}

export interface SaveCrawlResult {
  contentId: string;
  newPages: Array<{ id: string; url: string }>;
}

export async function saveCrawlResult(db: DbOrTx, args: SaveCrawlArgs): Promise<SaveCrawlResult> {
  const { pid, extracted, links, blob } = args;
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

  // Concurrent page-crawl workers each open a transaction that bulk-upserts
  // pages by URL. The unique index on `pages.url` is locked in row order, and
  // extractors emit links in document order — different pages = different
  // lock sequences = classic deadlock cycle
  // (`Process A waits on X held by B; B waits on Y held by A`).
  // Sort by `id` so every transaction acquires index locks in the same
  // deterministic order → no cycle. Same for `page_links` (PK on `id`).
  edges.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  targetPageRows.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return db.transaction(async (tx) => {
    await markCrawling(tx, pid, now);
    await upsertMetadata(tx, pid, metaSet);
    const cid = await upsertContent(tx, pid, blob, now);
    const newPages = await insertTargetPages(tx, targetPageRows);
    await insertEdges(tx, edges, pid);
    await markCrawledTx(tx, pid, now);
    return { contentId: cid, newPages };
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

async function upsertContent(
  tx: DbOrTx,
  pid: string,
  blob: UploadResult,
  now: Date,
): Promise<string> {
  const kind = 'page' as const;
  const mimeType = 'text/html';
  const id = contentId(pid, kind, mimeType);
  await tx
    .insert(pageContents)
    .values({
      id,
      pageId: pid,
      kind,
      mimeType,
      blobPath: blob.path,
      blobSize: blob.size,
      blobHash: blob.hash,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [pageContents.pageId, pageContents.kind, pageContents.mimeType],
      set: {
        blobPath: blob.path,
        blobSize: blob.size,
        blobHash: blob.hash,
        updatedAt: now,
      },
    });
  return id;
}

function insertTargetPages(
  tx: DbOrTx,
  rows: Array<{ id: string; url: string; status: 'pending' }>,
): Promise<Array<{ id: string; url: string }>> {
  return insertBulk(tx, pages, rows, (t) => ({ id: t.id, url: t.url }));
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
