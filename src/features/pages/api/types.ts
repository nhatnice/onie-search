import { linkTypeEnum } from './schema';

export type LinkType = (typeof linkTypeEnum.enumValues)[number];

export interface Link {
  url: string;
  type: LinkType;
  source: 'anchor' | 'sitemap' | 'meta';
}

/** A link from a crawled page that we know how to enqueue for crawling. */
export interface CrawlableLink {
  url: string;
  type: LinkType;
}

export interface ExtractedPage {
  title?: string;
  description?: string;
  thumbnail?: string;
  favicon?: string;
  jsonLd: unknown[];
  cleanMarkdown?: string;
  cleanHtml?: string;
  rawHtml: string;
  language?: string;
  author?: string;
  publishedAt?: string;
  modifiedAt?: string;
}
