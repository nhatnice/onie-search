import type { DiscoveredFeed, FeedType } from '@/crawl/extractors/types';

const FEED_TYPES: readonly FeedType[] = ['sitemap', 'rss', 'atom', 'json_feed'];

function isFeedType(value: string): value is FeedType {
  return (FEED_TYPES as readonly string[]).includes(value);
}

export function parseSeedFeeds(raw: string): DiscoveredFeed[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const schemeIdx = entry.indexOf('://');
      if (schemeIdx === -1 || !/^https?$/.test(entry.slice(0, schemeIdx))) {
        throw new Error(`Invalid seed entry "${entry}" — must start with http:// or https://`);
      }
      const typeStart = entry.indexOf(':', schemeIdx + 3);
      if (typeStart === -1) {
        throw new Error(`Invalid seed entry "${entry}" — expected "url:type" (e.g. ${entry}:rss)`);
      }
      const url = entry.slice(0, typeStart).trim();
      const type = entry.slice(typeStart + 1).trim();
      if (!url) throw new Error(`Invalid seed entry "${entry}" — empty URL`);
      if (!isFeedType(type)) {
        throw new Error(
          `Invalid feed type "${type}" in "${entry}" — must be one of: ${FEED_TYPES.join(', ')}`,
        );
      }
      return { url, type };
    });
}
