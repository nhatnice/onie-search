import { createSilentJSDOM } from '../jsdom';
import type { CrawlResponse } from '../types';
import type {
  DiscoveredFeed,
  FeedExtractionResult,
  FeedExtractor,
  PageExtractionResult,
  PageExtractor,
  RawLink,
} from './types';

interface ParsedSitemap {
  pageLinks: RawLink[];
  childFeeds: DiscoveredFeed[];
}

function parseSitemap(response: CrawlResponse): ParsedSitemap {
  const xml = typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
  const dom = createSilentJSDOM(xml, { contentType: 'text/xml' });
  const document = dom.window.document;
  const seenLink = new Set<string>();
  const seenFeed = new Set<string>();
  const pageLinks: RawLink[] = [];
  const childFeeds: DiscoveredFeed[] = [];

  for (const loc of Array.from(document.querySelectorAll('sitemapindex > sitemap > loc'))) {
    const text = loc.textContent?.trim();
    if (!text || seenFeed.has(text)) continue;
    seenFeed.add(text);
    childFeeds.push({ url: text, type: 'sitemap' });
  }
  for (const loc of Array.from(document.querySelectorAll('urlset > url > loc'))) {
    const text = loc.textContent?.trim();
    if (!text || seenLink.has(text)) continue;
    seenLink.add(text);
    pageLinks.push({ url: text, type: 'sitemap', source: 'sitemap' });
  }
  return { pageLinks, childFeeds };
}

export class SitemapExtractor implements PageExtractor, FeedExtractor {
  readonly name = 'sitemap';

  matches(contentType: string): boolean {
    return /^application\/(xml|\+xml)|text\/xml/i.test(contentType);
  }

  extractPage(response: CrawlResponse): PageExtractionResult {
    const { pageLinks, childFeeds } = parseSitemap(response);
    return {
      document: createSilentJSDOM('', { contentType: 'text/xml' }).window.document,
      rawHtml: typeof response.body === 'string' ? response.body : response.body.toString('utf-8'),
      links: pageLinks,
      feeds: childFeeds,
    };
  }

  extractFeed(response: CrawlResponse): FeedExtractionResult {
    const { pageLinks, childFeeds } = parseSitemap(response);
    return { links: pageLinks, feeds: childFeeds };
  }
}
