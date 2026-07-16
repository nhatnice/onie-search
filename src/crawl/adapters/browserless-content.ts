import { env } from '@/lib/env';

import type { CrawlResponse } from '../types';
import type { CrawlerAdapter } from './adapter';

function buildBrowserlessContentEndpoint(): string {
  // Browserless exposes two transports: `wss://` for Puppeteer/CDP sessions
  // and `https://` for the REST content/scrape API. The Content endpoint is
  // HTTP-only — `new URL('wss://...')` keeps the scheme, undici rejects `wss:`
  // with `fetch failed: unknown scheme`. Normalize before constructing.
  const url = new URL(env.browserlessUrl);
  if (url.protocol === 'wss:') url.protocol = 'https:';
  else if (url.protocol === 'ws:') url.protocol = 'http:';
  url.pathname = '/content';
  url.searchParams.set('token', env.browserlessToken);
  return url.toString();
}

export class BrowserlessContentAdapter implements CrawlerAdapter {
  readonly name = 'browserless-content';

  async crawl(url: string): Promise<CrawlResponse> {
    const started = Date.now();
    const endpoint = buildBrowserlessContentEndpoint();
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url,
        rejectResourceTypes: ['image', 'font', 'stylesheet', 'media'],
        gotoOptions: { waitUntil: 'domcontentloaded' },
      }),
    });
    if (!res.ok) throw new Error(`browserless-content ${res.status}: ${await res.text()}`);
    const html = await res.text();
    return {
      url,
      statusCode: res.status,
      contentType: 'text/html',
      body: Buffer.from(html, 'utf-8'),
      headers: {},
      durationMs: Date.now() - started,
    };
  }

  async close() {}
}
