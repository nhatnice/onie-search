import { createSilentJSDOM } from '../jsdom';
import type { CrawlResponse } from '../types';
import type { FeedExtractionResult, FeedExtractor, RawLink } from './types';

export class RssExtractor implements FeedExtractor {
  readonly name = 'rss';

  matches(contentType: string): boolean {
    return /^application\/(rss|rdf)\+xml/i.test(contentType);
  }

  extractFeed(response: CrawlResponse): FeedExtractionResult {
    const xml = typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
    const dom = createSilentJSDOM(xml, { contentType: 'text/xml' });
    const document = dom.window.document;
    const seen = new Set<string>();
    const links: RawLink[] = [];

    for (const item of Array.from(document.querySelectorAll('item'))) {
      const link = item.querySelector('link')?.textContent?.trim();
      if (!link || seen.has(link)) continue;
      seen.add(link);
      links.push({ url: link, type: 'sitemap', source: 'sitemap' });
    }
    for (const a of Array.from(document.querySelectorAll('item > a[href]'))) {
      const href = a.getAttribute('href')?.trim();
      if (!href || seen.has(href)) continue;
      seen.add(href);
      links.push({ url: href, type: 'sitemap', source: 'anchor' });
    }
    return { links, feeds: [] };
  }
}
