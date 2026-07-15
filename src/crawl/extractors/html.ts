import { createSilentJSDOM } from '../jsdom';
import type { CrawlResponse } from '../types';
import { extractFeedLinks } from './feed-links';
import { extractAnchorLinks, extractSitemapHints } from './html-links';
import type { PageExtractionResult, PageExtractor } from './types';

export class HtmlExtractor implements PageExtractor {
  readonly name = 'html';

  matches(contentType: string): boolean {
    return /^text\/html/i.test(contentType);
  }

  extractPage(response: CrawlResponse): PageExtractionResult {
    const rawHtml =
      typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
    const dom = createSilentJSDOM(rawHtml, { url: response.url });
    const document = dom.window.document;
    const feeds = [
      ...extractFeedLinks(document, response.url),
      ...extractSitemapHints(document, response.url).map((url) => ({
        url,
        type: 'sitemap' as const,
      })),
    ];

    return {
      document,
      rawHtml,
      links: extractAnchorLinks(document, response.url),
      feeds,
    };
  }
}
