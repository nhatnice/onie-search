import { createSilentJSDOM } from '../jsdom';
import type { CrawlResponse } from '../types';
import { extractAnchorLinks, extractSitemapHints } from './html-links';
import type { ExtractionResult, Extractor } from './types';

export class HtmlExtractor implements Extractor {
  readonly name = 'html';

  matches(contentType: string): boolean {
    return /^text\/html/i.test(contentType);
  }

  extract(response: CrawlResponse): ExtractionResult {
    const rawHtml =
      typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
    const dom = createSilentJSDOM(rawHtml, { url: response.url });
    const document = dom.window.document;

    return {
      document,
      rawHtml,
      links: extractAnchorLinks(document, response.url),
      sitemapUrls: extractSitemapHints(document, response.url),
    };
  }
}
