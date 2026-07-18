import { Buffer } from 'node:buffer';

import type { CrawlResponse } from '../types';
import type { CrawlerAdapter } from './adapter';

/** Lightweight HTTP crawler — Node built-in fetch. No Chromium, no JS execution. */
export class FetchCrawlerAdapter implements CrawlerAdapter {
  readonly name = 'fetch';

  async crawl(url: string): Promise<CrawlResponse> {
    const started = Date.now();
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ove-crawler/1.0)' },
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => {
      headers[k] = v;
    });
    const contentType = headers['content-type'] ?? 'application/octet-stream';
    const body = Buffer.from(await res.arrayBuffer());
    return {
      url: res.url || url,
      statusCode: res.status,
      contentType,
      body,
      headers,
      durationMs: Date.now() - started,
    };
  }

  async close(): Promise<void> {
    // ponytail: fetch has no persistent resources to release
  }
}
