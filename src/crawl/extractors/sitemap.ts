import { JSDOM } from 'jsdom';

import type { CrawlResponse } from '../types';
import type { ExtractionResult, Extractor, RawLink } from './types';

export class SitemapExtractor implements Extractor {
  readonly name = 'sitemap';

  matches(contentType: string): boolean {
    return /^application\/(xml|\+xml)|text\/xml/i.test(contentType);
  }

  extract(response: CrawlResponse): ExtractionResult {
    const xml = typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
    const dom = new JSDOM(xml, { contentType: 'text/xml' });
    const document = dom.window.document;
    const seen = new Set<string>();
    const links: RawLink[] = [];

    for (const loc of Array.from(document.querySelectorAll('url > loc, sitemap > loc'))) {
      const text = loc.textContent?.trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      links.push({ url: text, type: 'sitemap', source: 'sitemap' });
    }
    return { links, sitemapUrls: [] };
  }
}
