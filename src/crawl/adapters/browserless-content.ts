import { env } from '@/lib/env';

import type { CrawlResponse } from '../types';
import type { CrawlerAdapter } from './adapter';

function buildBrowserlessContentEndpoint(): string {
  const url = new URL(env.browserlessUrl);
  url.pathname = '/chromium/content';
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
    const body = (await res.json()) as unknown;
    const html =
      typeof body === 'object' && body !== null && 'html' in body ? String(body.html) : '';
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
