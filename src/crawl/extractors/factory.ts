import { AtomExtractor } from './atom';
import { HtmlExtractor } from './html';
import { JsonFeedExtractor } from './json-feed';
import { RssExtractor } from './rss';
import { SitemapExtractor } from './sitemap';
import type { FeedExtractor, FeedType, PageExtractor } from './types';

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

const extractorByFeedType: Record<FeedType, FeedExtractor> = {
  rss: rssExtractor,
  atom: atomExtractor,
  json_feed: jsonFeedExtractor,
  sitemap: sitemapExtractor,
};

const noopFeedExtractor: FeedExtractor = {
  name: 'noop',
  matches: () => false,
  extractFeed: () => ({ links: [], feeds: [] }),
};

function firstMatch<T extends { matches: (ct: string) => boolean }>(
  candidates: readonly T[],
  contentType: string,
): T | undefined {
  return candidates.find((e) => e.matches(contentType));
}

// Feed parsers sniff the root element when content-type is generic
// (application/xml, text/xml, application/octet-stream) because many
// servers don't set the specific +rss/+atom media type. Standard practice
// in feedparser (Python), browser feed preview, W3C feed-sniffing spec.
function sniffFeedType(body: string): FeedType | undefined {
  const match = body.trimStart().match(/^<\??([\w:]+)/);
  if (!match) return undefined;
  const root = match[1].toLowerCase();
  if (root === 'rss' || root === 'rdf:rdf') return 'rss';
  if (root === 'feed') return 'atom';
  if (root === 'urlset' || root === 'sitemapindex') return 'sitemap';
  return undefined;
}

export function findPageExtractor(contentType: string): PageExtractor {
  return firstMatch(pageExtractors, contentType) ?? htmlExtractor;
}

export function findFeedExtractor(contentType: string, body?: string): FeedExtractor {
  const byCt = firstMatch(feedExtractors, contentType);
  if (byCt) return byCt;
  if (body) {
    const sniffed = sniffFeedType(body);
    if (sniffed) return extractorByFeedType[sniffed];
  }
  return noopFeedExtractor;
}
