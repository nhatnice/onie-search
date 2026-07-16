export const PAGE_CREATED = 'page.created' as const;
export const PAGE_CONTENT_CREATED = 'page-content.created' as const;
export const FEED_DISCOVERY_REQUESTED = 'feed.discovery.requested' as const;

export const PAGE_CRAWL_FUNCTION_ID = 'page-crawl' as const;
export const FEED_DISCOVERY_DISPATCHER_FUNCTION_ID = 'feed-discovery-dispatcher' as const;
export const FEED_DISCOVERY_WORKER_FUNCTION_ID = 'feed-discovery-worker' as const;

export interface PageCreatedData {
  pageId: string;
  url: string;
}

export interface PageContentCreatedData {
  pageId: string;
  contentId: string;
  kind: 'page' | 'media' | 'file';
}

export interface FeedDiscoveryRequestedData {
  feedId: string;
  url: string;
  type: 'sitemap' | 'rss' | 'atom' | 'json_feed';
}
