import type { GetStepTools, Inngest } from 'inngest';

import type { DiscoveredFeed } from '@/crawl/extractors/types';
import type { DbOrTx } from '@/db/types';
import { PAGE_CREATED, type PageCreatedData } from '@/inngest/events';

import { insertDiscoveredPages, insertFeeds, markFeedScanned } from '../queries';

type Step = GetStepTools<Inngest.Any>;

export async function discoverAndEmitPages(
  db: DbOrTx,
  urls: readonly string[],
  step: Step,
): Promise<{ inserted: number }> {
  const rows = await step.run('insert-discovered-pages', () => insertDiscoveredPages(db, urls));
  if (rows.length === 0) return { inserted: 0 };
  await emitPageCreatedEvents(rows, step);
  return { inserted: rows.length };
}

export async function insertFeedLinks(
  db: DbOrTx,
  feedLinks: readonly DiscoveredFeed[],
): Promise<void> {
  await insertFeeds(db, feedLinks);
}

async function emitPageCreatedEvents(
  rows: ReadonlyArray<{ id: string; url: string }>,
  step: Step,
): Promise<void> {
  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    name: PAGE_CREATED,
    data: { pageId: r.id, url: r.url } satisfies PageCreatedData,
  }));
  await step.sendEvent('emit-page-created', payload);
}

export async function persistFeedDiscovery(
  db: DbOrTx,
  feedId: string,
  extracted: { links: readonly string[]; feeds: readonly DiscoveredFeed[] },
  step: Step,
): Promise<{ pagesAdded: number; feedsAdded: number }> {
  const [pagesAdded] = await Promise.all([
    discoverAndEmitPages(db, extracted.links, step),
    insertFeedLinks(db, extracted.feeds),
  ]);
  await markFeedScanned(db, feedId);
  return { pagesAdded: pagesAdded.inserted, feedsAdded: extracted.feeds.length };
}
