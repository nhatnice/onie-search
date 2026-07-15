import { safeUrl } from './html-utils';
import type { DiscoveredFeed, FeedType } from './types';

const TYPE_MAP: Record<string, FeedType> = {
  'application/rss+xml': 'rss',
  'application/atom+xml': 'atom',
  'application/feed+json': 'json_feed',
  'application/jsonfeed': 'json_feed',
};

function feedTypeOf(mime: string): FeedType | undefined {
  const lower = mime.toLowerCase().split(';')[0].trim();
  return TYPE_MAP[lower];
}

export function extractFeedLinks(document: Document, baseUrl: string): DiscoveredFeed[] {
  const seen = new Set<string>();
  const feeds: DiscoveredFeed[] = [];

  for (const link of Array.from(document.querySelectorAll('link[rel="alternate"][type][href]'))) {
    const type = link.getAttribute('type');
    if (!type) continue;
    const feedType = feedTypeOf(type);
    if (!feedType) continue;
    const href = link.getAttribute('href')?.trim();
    if (!href) continue;
    const resolved = safeUrl(href, baseUrl);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    feeds.push({ url: resolved, type: feedType });
  }
  for (const link of Array.from(document.querySelectorAll('link[rel="sitemap"][href]'))) {
    const href = link.getAttribute('href')?.trim();
    if (!href) continue;
    const resolved = safeUrl(href, baseUrl);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    feeds.push({ url: resolved, type: 'sitemap' });
  }
  return feeds;
}
