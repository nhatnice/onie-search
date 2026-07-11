import { HtmlExtractor } from './html';
import { SitemapExtractor } from './sitemap';
import type { Extractor } from './types';

const htmlExtractor = new HtmlExtractor();
const sitemapExtractor = new SitemapExtractor();

/**
 * Route a response to the right extractor. Falls back to HTML for unknown
 * content types — HTML pages are the most common crawl target.
 */
export function findPageExtractor(contentType: string): Extractor {
  if (sitemapExtractor.matches(contentType)) return sitemapExtractor;
  if (htmlExtractor.matches(contentType)) return htmlExtractor;
  return htmlExtractor;
}
