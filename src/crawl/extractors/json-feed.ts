import type { CrawlResponse } from '../types';
import type { FeedExtractionResult, FeedExtractor, RawLink } from './types';

export class JsonFeedExtractor implements FeedExtractor {
  readonly name = 'json-feed';

  matches(contentType: string): boolean {
    return /^application\/(feed\+json|json)/i.test(contentType);
  }

  extractFeed(response: CrawlResponse): FeedExtractionResult {
    const text =
      typeof response.body === 'string' ? response.body : response.body.toString('utf-8');
    const seen = new Set<string>();
    const links: RawLink[] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { links, feeds: [] };
    }
    if (!parsed || typeof parsed !== 'object') return { links, feeds: [] };
    const feed = parsed as { items?: unknown };
    if (!Array.isArray(feed.items)) return { links, feeds: [] };

    for (const item of feed.items) {
      if (!item || typeof item !== 'object') continue;
      const it = item as Record<string, unknown>;
      const candidates = [it['url'], it['external_url']];
      for (const c of candidates) {
        if (typeof c !== 'string') continue;
        const trimmed = c.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        links.push({ url: trimmed, type: 'sitemap', source: 'sitemap' });
      }
    }
    return { links, feeds: [] };
  }
}
