import type { CrawlResponse } from '../types';

export type FeedType = 'sitemap' | 'rss' | 'atom' | 'json_feed';

export interface DiscoveredFeed {
  url: string;
  type: FeedType;
}

export interface RawLink {
  url: string;
  type: 'internal' | 'outbound' | 'sitemap';
  source: 'anchor' | 'sitemap' | 'meta';
}

export interface PageExtractionResult {
  document: Document;
  rawHtml: string;
  links: RawLink[];
  feeds: DiscoveredFeed[];
  close?: () => void;
}

export interface FeedExtractionResult {
  links: RawLink[];
  feeds: DiscoveredFeed[];
}

export interface PageExtractor {
  readonly name: string;
  matches(contentType: string): boolean;
  extractPage(response: CrawlResponse): PageExtractionResult;
}

export interface FeedExtractor {
  readonly name: string;
  matches(contentType: string): boolean;
  extractFeed(response: CrawlResponse): FeedExtractionResult;
}
