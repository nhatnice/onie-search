import { facebookReactAdapter } from './facebook';
import type { PostReactCrawlAdapter } from './types';

const adapters: readonly PostReactCrawlAdapter[] = [facebookReactAdapter];

const registry = new Map<string, PostReactCrawlAdapter>(adapters.map((a) => [a.platform, a]));

export function findPostReactCrawlAdapter(platformId: string): PostReactCrawlAdapter {
  const adapter = registry.get(platformId);
  if (!adapter) throw new Error(`No post-react crawl adapter for platform: ${platformId}`);
  return adapter;
}
