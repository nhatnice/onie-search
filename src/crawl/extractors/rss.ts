import type { CrawlResponse } from '../types';
import type { FeedExtractionResult, FeedExtractor, RawLink } from './types';

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

export class RssExtractor implements FeedExtractor {
  readonly name = 'rss';

  matches(contentType: string): boolean {
    return /^application\/(rss|rdf)\+xml/i.test(contentType);
  }

  extractFeed(response: CrawlResponse): FeedExtractionResult {
    const xml = typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
    const seen = new Set<string>();
    const links: RawLink[] = [];

    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let itemMatch;
    while ((itemMatch = itemRegex.exec(xml)) !== null) {
      const itemContent = itemMatch[1];

      // 1. Match <link>url</link>
      const linkRegex = /<link>([\s\S]*?)<\/link>/i;
      const linkMatch = linkRegex.exec(itemContent);
      if (linkMatch) {
        const link = cleanXmlText(linkMatch[1]);
        if (link && !seen.has(link)) {
          seen.add(link);
          links.push({ url: link, type: 'sitemap', source: 'sitemap' });
        }
      }

      // 2. Match <a href="..."> inside itemContent
      const anchorRegex = /<a[^>]+href=["']([^"']+)["']/gi;
      let anchorMatch;
      while ((anchorMatch = anchorRegex.exec(itemContent)) !== null) {
        const href = cleanXmlText(anchorMatch[1]);
        if (href && !seen.has(href)) {
          seen.add(href);
          links.push({ url: href, type: 'sitemap', source: 'anchor' });
        }
      }
    }
    return { links, feeds: [] };
  }
}
