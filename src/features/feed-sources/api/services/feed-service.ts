import type { DiscoveredFeed } from '@/crawl/extractors/types';
import type { DbOrTx } from '@/db/types';
import { inngest } from '@/inngest/client';
import { PAGE_CREATED, type PageCreatedData } from '@/inngest/events';
import { pageId } from '@/lib/url';

import { insertDiscoveredPages, insertFeeds, markFeedScanned } from '../queries';

// Inngest caps events per send() at 5000 (inngest.com/docs/usage-limits).
// Large sitemaps (tinhte.vn, genk.vn) return 30k-50k links per fetch — batch.
const INNGEST_SEND_BATCH = 5000;

export async function insertFeedLinks(
  db: DbOrTx,
  feedLinks: readonly DiscoveredFeed[],
): Promise<void> {
  await insertFeeds(db, feedLinks);
}

// Plain async (no `step` param, no `step.run` inside) because this is
// now called FROM WITHIN a single `step.run('fetch-extract-persist')` in
// the worker. Nesting `step.run` inside another `step.run` violates
// @inngest/no-nested-steps. All "non-determinism" is inside the outer
// step boundary so the checkpointing engine can checkpoint it.
export async function persistFeedDiscovery(
  db: DbOrTx,
  feedId: string,
  extracted: { links: readonly string[]; feeds: readonly DiscoveredFeed[] },
): Promise<{ pagesAdded: number; feedsAdded: number }> {
  const [pagesAdded, feedsAdded] = await Promise.all([
    insertDiscoveredPages(db, extracted.links),
    insertFeeds(db, extracted.feeds),
  ]);

  // inngest.send (NOT step.sendEvent) — raw client method, not a step tool.
  // Fire-and-forget: if the outer step retries (e.g. maxRuntime timeout),
  // events are re-sent; page-crawl worker dedupes by pageId idempotency key.
  // pageId is deterministic (sha1 of normalized URL), so we emit for all
  // input URLs without querying DB for the actually-inserted subset.
  // onConflictDoNothing means some are duplicates — safe.
  await emitPageCreated(extracted.links);

  await markFeedScanned(db, feedId);
  return { pagesAdded, feedsAdded };
}

async function emitPageCreated(urls: readonly string[]): Promise<void> {
  if (urls.length === 0) return;
  for (let i = 0; i < urls.length; i += INNGEST_SEND_BATCH) {
    const slice = urls.slice(i, i + INNGEST_SEND_BATCH);
    const payload = slice.map((url) => ({
      name: PAGE_CREATED,
      data: { pageId: pageId(url), url } satisfies PageCreatedData,
    }));
    // fire-and-forget — log on error, don't block worker on event send
    void inngest.send(payload).catch((err) => {
      console.error('[feed-service] emit page.created failed', err);
    });
  }
}
