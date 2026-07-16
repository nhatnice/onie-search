import type { DiscoveredFeed } from '@/crawl/extractors/types';
import type { DbOrTx } from '@/db/types';
import { eventEmitter, PAGE_CREATED } from '@/events/emitter';
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

  await emitPageCreated(extracted.links);

  await markFeedScanned(db, feedId);
  return { pagesAdded, feedsAdded };
}

async function emitPageCreated(urls: readonly string[]): Promise<void> {
  if (urls.length === 0) return;

  const batchSize = 100;
  for (let i = 0; i < urls.length; i += batchSize) {
    const chunk = urls.slice(i, i + batchSize);
    for (const url of chunk) {
      eventEmitter.emit(PAGE_CREATED, { pageId: pageId(url), url });
    }
    // Yield to the event loop to prevent blocking or overwhelming connections
    // eslint-disable-next-line eslint/no-await-in-loop
    await new Promise((resolve) => setImmediate(resolve));
  }
}
