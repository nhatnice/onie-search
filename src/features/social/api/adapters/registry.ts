import { facebookAdapter } from './facebook';
import { instagramAdapter } from './instagram';
import { tiktokAdapter } from './tiktok';
import type { CookieRefreshAdapter } from './types';

const adapters: readonly CookieRefreshAdapter[] = [
  facebookAdapter,
  instagramAdapter,
  tiktokAdapter,
];

const registry = new Map<string, CookieRefreshAdapter>(adapters.map((a) => [a.platform, a]));

export function findCookieRefreshAdapter(platform: string): CookieRefreshAdapter {
  const adapter = registry.get(platform);
  if (!adapter) throw new Error(`No cookie refresh adapter for platform: ${platform}`);
  return adapter;
}
