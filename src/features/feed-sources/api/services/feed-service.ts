import type { DiscoveredFeed } from '@/crawl/extractors/types';
import type { DbOrTx } from '@/db/types';
import { eventEmitter, PAGES_CREATED } from '@/events/emitter';
import { insertDiscoveredPages } from '@/features/pages/api/services/page-service';
import { pageId } from '@/lib/url';

import { insertFeeds, markFeedScanned } from '../queries';

export async function insertFeedLinks(
  db: DbOrTx,
  feedLinks: readonly DiscoveredFeed[],
): Promise<void> {
  await insertFeeds(db, feedLinks);
}

export async function persistFeedDiscovery(
  db: DbOrTx,
  feedId: string,
  extracted: { links: readonly string[]; feeds: readonly DiscoveredFeed[] },
): Promise<{ pagesAdded: number; feedsAdded: number }> {
  const [pagesAdded, feedsAdded] = await Promise.all([
    insertDiscoveredPages(db, extracted.links),
    insertFeeds(db, extracted.feeds),
  ]);

  if (extracted.links.length > 0) {
    await eventEmitter.emitAsync(PAGES_CREATED, {
      pages: extracted.links.map((url) => ({ pageId: pageId(url), url })),
    });
  }

  await markFeedScanned(db, feedId);
  return { pagesAdded, feedsAdded };
}
