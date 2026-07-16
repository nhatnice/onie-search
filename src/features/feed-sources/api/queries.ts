import { and, asc, eq, inArray, isNull, lt, or, type SQL } from 'drizzle-orm';

import type { DiscoveredFeed } from '@/crawl/extractors/types';
import { db as defaultDb, insertBulk, type Db, type DbOrTx } from '@/db';
import { pageId } from '@/lib/url';

import { feeds, type Feed } from './schema';

const ONE_HOUR_MS = 60 * 60 * 1000;

function notDeleted(): SQL {
  return isNull(feeds.deletedAt);
}

export function feedId(url: string): string {
  return pageId(url);
}

export function insertFeeds(db: DbOrTx, discovered: readonly DiscoveredFeed[]): Promise<number> {
  if (discovered.length === 0) return Promise.resolve(0);
  const rows = discovered.map((d) => ({
    id: feedId(d.url),
    url: d.url,
    type: d.type,
    status: 'pending' as const,
  }));
  return insertBulk(db, feeds, rows, (t) => ({ id: t.id })).then((r) => r.length);
}

export async function getFeedsToScan(
  db: DbOrTx,
  limit: number,
  now: Date = new Date(),
): Promise<Feed[]> {
  const threshold = new Date(now.getTime() - ONE_HOUR_MS);
  return db
    .select()
    .from(feeds)
    .where(
      and(
        inArray(feeds.status, ['pending', 'failed']),
        notDeleted(),
        or(isNull(feeds.lastScannedAt), lt(feeds.lastScannedAt, threshold)),
      ),
    )
    .orderBy(asc(feeds.lastScannedAt), asc(feeds.updatedAt))
    .limit(limit);
}

export async function markFeedScanning(db: DbOrTx, id: string): Promise<void> {
  await db.update(feeds).set({ status: 'scanning', updatedAt: new Date() }).where(eq(feeds.id, id));
}

export async function markFeedScanned(db: DbOrTx, id: string): Promise<void> {
  const now = new Date();
  await db
    .update(feeds)
    .set({ status: 'scanned', lastScannedAt: now, updatedAt: now })
    .where(eq(feeds.id, id));
}

export async function markFeedFailed(db: DbOrTx, id: string): Promise<void> {
  await db.update(feeds).set({ status: 'failed', updatedAt: new Date() }).where(eq(feeds.id, id));
}

export function getDefaultDb(): Db {
  return defaultDb;
}
