import type { CrawlResponse } from '../types';

/** Raw extracted data — extractors return structured primitives, not domain objects. */
export interface ExtractionResult {
  /** Parsed DOM — null for non-HTML (XML, JSON). Caller reuses it for content extraction. */
  document?: Document;
  /** Sitemap URLs discovered via <link rel="sitemap"> or robots.txt hint. */
  sitemapUrls: string[];
  /** Raw HTML body for page extractors. Undefined for non-HTML (XML, JSON). */
  rawHtml?: string;
  /** Parsed links — internal, outbound, sitemap. Caller filters for crawlability. */
  links: RawLink[];
}

/** Generic link — lib/crawl does not know about page-specific LinkType. */
export interface RawLink {
  url: string;
  type: 'internal' | 'outbound' | 'sitemap';
  source: 'anchor' | 'sitemap' | 'meta';
}

export interface Extractor {
  readonly name: string;
  matches(contentType: string): boolean;
  extract(response: CrawlResponse): ExtractionResult;
}
