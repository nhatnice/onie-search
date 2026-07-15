import { createSilentJSDOM } from '../jsdom';
import type { CrawlResponse } from '../types';
import type { FeedExtractionResult, FeedExtractor, RawLink } from './types';

export class AtomExtractor implements FeedExtractor {
  readonly name = 'atom';

  matches(contentType: string): boolean {
    return /^application\/atom\+xml/i.test(contentType);
  }

  extractFeed(response: CrawlResponse): FeedExtractionResult {
    const xml = typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
    const dom = createSilentJSDOM(xml, { contentType: 'text/xml' });
    const document = dom.window.document;
    const seen = new Set<string>();
    const links: RawLink[] = [];

    for (const entry of Array.from(document.querySelectorAll('entry'))) {
      const linkEl = entry.querySelector('link[rel="alternate"], link:not([rel])');
      const href = linkEl?.getAttribute('href')?.trim();
      if (!href || seen.has(href)) continue;
      seen.add(href);
      links.push({ url: href, type: 'sitemap', source: 'sitemap' });
    }
    return { links, feeds: [] };
  }
}
