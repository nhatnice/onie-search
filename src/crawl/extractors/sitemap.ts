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

function cleanXmlText(text: string): string {
  text = text.trim();
  if (text.startsWith('<![CDATA[') && text.endsWith(']]>')) {
    text = text.substring(9, text.length - 3).trim();
  }
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function parseSitemap(response: CrawlResponse): ParsedSitemap {
  const xml = typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
  const pageLinks: RawLink[] = [];
  const childFeeds: DiscoveredFeed[] = [];
  const seenLink = new Set<string>();
  const seenFeed = new Set<string>();

  const sitemapRegex = /<sitemap>[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/sitemap>/gi;
  let match;
  while ((match = sitemapRegex.exec(xml)) !== null) {
    const url = cleanXmlText(match[1]);
    if (url && !seenFeed.has(url)) {
      seenFeed.add(url);
      childFeeds.push({ url, type: 'sitemap' });
    }
  }

  const urlRegex = /<url>[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/url>/gi;
  while ((match = urlRegex.exec(xml)) !== null) {
    const url = cleanXmlText(match[1]);
    if (url && !seenLink.has(url)) {
      seenLink.add(url);
      pageLinks.push({ url, type: 'sitemap', source: 'sitemap' });
    }
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
    const dom = createSilentJSDOM('', { contentType: 'text/xml' });
    return {
      document: dom.window.document,
      rawHtml: typeof response.body === 'string' ? response.body : response.body.toString('utf-8'),
      links: pageLinks,
      feeds: childFeeds,
      close: () => dom.window.close(),
    };
  }

  extractFeed(response: CrawlResponse): FeedExtractionResult {
    const { pageLinks, childFeeds } = parseSitemap(response);
    return { links: pageLinks, feeds: childFeeds };
  }
}
