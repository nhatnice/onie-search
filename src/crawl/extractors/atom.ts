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

export class AtomExtractor implements FeedExtractor {
  readonly name = 'atom';

  matches(contentType: string): boolean {
    return /^application\/atom\+xml/i.test(contentType);
  }

  extractFeed(response: CrawlResponse): FeedExtractionResult {
    const xml = typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
    const seen = new Set<string>();
    const links: RawLink[] = [];

    const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
    let entryMatch;
    while ((entryMatch = entryRegex.exec(xml)) !== null) {
      const entryContent = entryMatch[1];
      const linkRegex = /<link([^>]+)>/gi;
      let linkMatch;
      let fallbackHref: string | null = null;
      let alternateHref: string | null = null;

      while ((linkMatch = linkRegex.exec(entryContent)) !== null) {
        const attrs = linkMatch[1];
        const hrefMatch = /href=["']([^"']+)["']/i.exec(attrs);
        const relMatch = /rel=["']([^"']+)["']/i.exec(attrs);

        if (hrefMatch) {
          const href = cleanXmlText(hrefMatch[1]);
          const rel = relMatch ? relMatch[1].toLowerCase().trim() : '';

          if (rel === 'alternate') {
            alternateHref = href;
          } else if (!rel) {
            fallbackHref = href;
          }
        }
      }

      const targetHref = alternateHref || fallbackHref;
      if (targetHref && !seen.has(targetHref)) {
        seen.add(targetHref);
        links.push({ url: targetHref, type: 'sitemap', source: 'sitemap' });
      }
    }
    return { links, feeds: [] };
  }
}
