import { defineTask } from 'nitro/task';

import { createSilentJSDOM } from '@/crawl';
import { extractFeedLinks } from '@/crawl/extractors/feed-links';
import { db } from '@/db/client';
import { insertFeeds } from '@/features/feed-sources/api/queries';
import { getCrawledPagesWithHtml } from '@/features/pages/api/queries';

// ponytail: no tracking column (feedsExtractedAt removed per request). Re-run scans
// all crawled pages each time — insertFeeds onConflictDoNothing makes this idempotent.
// Accept CPU waste trade-off for simplicity. Add tracking when scale demands it.
const BATCH_SIZE = 50;

export default defineTask({
  meta: {
    name: 'feed:discover-from-pages',
    description: 'Extract feed links (rss/atom/sitemap/json_feed) from crawled pages raw_html',
  },
  async run() {
    const pending = await getCrawledPagesWithHtml(db, BATCH_SIZE);
    if (pending.length === 0) {
      console.warn('[feed:discover-from-pages] no crawled pages with html');
      return { result: 'Nothing to do' };
    }

    let totalFeeds = 0;
    let pagesScanned = 0;
    // eslint-disable-next-line no-await-in-loop -- sequential keeps DB write order trivial to debug
    for (const page of pending) {
      if (!page.rawHtml) continue;
      try {
        const dom = createSilentJSDOM(page.rawHtml, { url: page.url });
        const feeds = extractFeedLinks(dom.window.document, page.url);
        if (feeds.length > 0) {
          const inserted = await insertFeeds(db, feeds);
          totalFeeds += inserted;
          console.warn(
            `[feed:discover-from-pages] page=${page.id} url=${page.url} feeds=+${inserted}/${feeds.length}`,
          );
        }
        pagesScanned++;
      } catch (err) {
        console.error(`[feed:discover-from-pages] fail page=${page.id} url=${page.url}`, err);
      }
    }

    console.warn(`[feed:discover-from-pages] scanned=${pagesScanned} feeds=+${totalFeeds}`);
    return { result: `Scanned ${pagesScanned} pages, added ${totalFeeds} feeds` };
  },
});
