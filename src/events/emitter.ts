import EventEmitter2 from 'eventemitter2';

export const PAGE_CREATED = 'page.created' as const;
export const PAGES_CREATED = 'pages.created' as const;
export const PAGE_CONTENT_CREATED = 'page-content.created' as const;
export const FEED_DISCOVERY_REQUESTED = 'feed.discovery.requested' as const;

export interface PageCreatedData {
  pageId: string;
  url: string;
}

export interface PagesCreatedData {
  pages: Array<{ pageId: string; url: string }>;
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

export const eventEmitter = new EventEmitter2({
  wildcard: true,
  delimiter: '.',
  maxListeners: 100,
});
