import type { DiscoveredFeed } from '@/crawl/extractors/types';
import type { DbOrTx } from '@/db/types';
import { inngest } from '@/inngest/client';
import { PAGE_CREATED, type PageCreatedData } from '@/inngest/events';

import { insertDiscoveredPages, insertFeeds, markFeedScanned } from '../queries';

export async function discoverAndEmitPages(
  db: DbOrTx,
  urls: readonly string[],
): Promise<{ inserted: number }> {
  const rows = await insertDiscoveredPages(db, urls);
  if (rows.length === 0) return { inserted: 0 };
  emitPageCreatedEvents(rows);
  return { inserted: rows.length };
}

export async function insertFeedLinks(
  db: DbOrTx,
  feedLinks: readonly DiscoveredFeed[],
): Promise<void> {
  await insertFeeds(db, feedLinks);
}

function emitPageCreatedEvents(rows: ReadonlyArray<{ id: string; url: string }>): void {
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    name: PAGE_CREATED,
    data: { pageId: r.id, url: r.url } satisfies PageCreatedData,
  }));
  void inngest.send(payload).catch((err) => {
    console.error('[feed-service] emit page.created failed', err);
  });
}

export async function persistFeedDiscovery(
  db: DbOrTx,
  feedId: string,
  extracted: { links: readonly string[]; feeds: readonly DiscoveredFeed[] },
): Promise<{ pagesAdded: number; feedsAdded: number }> {
  const [pagesAdded] = await Promise.all([
    discoverAndEmitPages(db, extracted.links),
    insertFeedLinks(db, extracted.feeds),
  ]);
  await markFeedScanned(db, feedId);
  return { pagesAdded: pagesAdded.inserted, feedsAdded: extracted.feeds.length };
}
