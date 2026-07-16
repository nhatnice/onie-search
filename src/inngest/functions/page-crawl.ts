import { db } from '@/db/client';
import {
  crawlPage,
  markPageFailed,
  type PageCrawlInput,
} from '@/features/pages/api/services/page-service';
import { inngest } from '@/inngest/client';
import { PAGE_CRAWL_FUNCTION_ID, PAGE_CREATED } from '@/inngest/events';

function isPageCrawlInput(value: unknown): value is PageCrawlInput {
  return (
    typeof value === 'object' &&
    value !== null &&
    'pageId' in value &&
    'url' in value &&
    typeof (value as { pageId: unknown }).pageId === 'string' &&
    typeof (value as { url: unknown }).url === 'string'
  );
}

const PAGE_CRAWL_CONCURRENCY = Number(process.env.PAGE_CRAWL_CONCURRENCY) || 50;

export const pageCrawlFunction = inngest.createFunction(
  {
    id: PAGE_CRAWL_FUNCTION_ID,
    triggers: [{ event: PAGE_CREATED }],
    retries: 3,
    concurrency: { limit: PAGE_CRAWL_CONCURRENCY },
    onFailure: async ({ event }) => {
      if (!isPageCrawlInput(event.data)) return;
      await markPageFailed(db, event.data);
    },
  },
  async ({ event, step }) => {
    if (!isPageCrawlInput(event.data)) {
      throw new Error(`Invalid page.created payload: ${JSON.stringify(event.data)}`);
    }
    return crawlPage(db, event.data, step);
  },
);
