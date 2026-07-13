import { env } from '@/lib/env';

export function buildBrowserlessEndpoint(): string {
  const url = new URL(env.browserlessUrl);
  url.searchParams.set('token', env.browserlessToken);
  url.searchParams.set('timeout', env.browserlessTimeoutMs);
  return url.toString();
}
