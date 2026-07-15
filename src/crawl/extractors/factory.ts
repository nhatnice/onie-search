import { AtomExtractor } from './atom';
import { HtmlExtractor } from './html';
import { JsonFeedExtractor } from './json-feed';
import { RssExtractor } from './rss';
import { SitemapExtractor } from './sitemap';
import type { FeedExtractor, PageExtractor } from './types';

const htmlExtractor = new HtmlExtractor();
const sitemapExtractor = new SitemapExtractor();
const rssExtractor = new RssExtractor();
const atomExtractor = new AtomExtractor();
const jsonFeedExtractor = new JsonFeedExtractor();

const pageExtractors: readonly PageExtractor[] = [sitemapExtractor, htmlExtractor];
const feedExtractors: readonly FeedExtractor[] = [
  rssExtractor,
  atomExtractor,
  jsonFeedExtractor,
  sitemapExtractor,
];

function firstMatch<T extends { matches: (ct: string) => boolean }>(
  candidates: readonly T[],
  contentType: string,
): T | undefined {
  return candidates.find((e) => e.matches(contentType));
}

export function findPageExtractor(contentType: string): PageExtractor {
  return firstMatch(pageExtractors, contentType) ?? htmlExtractor;
}

export function findFeedExtractor(contentType: string): FeedExtractor {
  return firstMatch(feedExtractors, contentType) ?? sitemapExtractor;
}
