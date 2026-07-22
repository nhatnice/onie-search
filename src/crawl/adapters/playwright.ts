import { Buffer } from 'node:buffer';

import {
  type Browser,
  type BrowserContext,
  type Page,
  type Response as PlaywrightResponse,
} from 'playwright-core';

import { getBrowser, isConnectionError } from '@/browser';

import type { CrawlResponse } from '../types';
import type { CrawlerAdapter } from './adapter';

export interface PlaywrightAdapterOptions {
  timeoutSecs?: number;
}

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'stylesheet']);

export class PlaywrightCrawlerAdapter implements CrawlerAdapter {
  readonly name = 'playwright';

  private context: BrowserContext | undefined;
  private readonly timeoutMs: number;

  constructor(opts: PlaywrightAdapterOptions = {}) {
    this.timeoutMs = (opts.timeoutSecs ?? 30) * 1000;
  }

  private async getContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    const browser: Browser = await getBrowser();
    this.context = browser.contexts()[0] ?? (await browser.newContext());
    installAssetBlocker(this.context);
    return this.context;
  }

  async crawl(url: string): Promise<CrawlResponse> {
    try {
      return await this.doCrawl(url);
    } catch (err) {
      if (isConnectionError(err)) {
        await this.resetConnection();
        return this.doCrawl(url);
      }
      throw err;
    }
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = undefined;
    }
  }

  private async doCrawl(url: string): Promise<CrawlResponse> {
    const started = Date.now();
    const context = await this.getContext();
    const page: Page = await context.newPage();
    try {
      page.setDefaultTimeout(this.timeoutMs);
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeoutMs,
      });
      const status = response?.status() ?? 0;
      const headers = response?.headers() ?? {};
      const contentType = headers['content-type'] ?? 'text/html';
      const body = await readResponseBody(response, page);
      return {
        url,
        statusCode: status,
        contentType,
        body,
        headers,
        durationMs: Date.now() - started,
      };
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  private async resetConnection(): Promise<void> {
    await this.close();
  }
}

// Chromium skips image/media/font/css so they never reach the DOM or RAM.
// <a href> text and HTML structure are unaffected (those come from the document, not loaded assets).
function installAssetBlocker(context: BrowserContext): void {
  void context.route('**/*', (route) => {
    const type = route.request().resourceType();
    if (BLOCKED_RESOURCE_TYPES.has(type)) return route.abort();
    return route.continue();
  });
}

// Prefer the original response bytes (cheaper) over re-serializing the live DOM.
async function readResponseBody(response: PlaywrightResponse | null, page: Page): Promise<Buffer> {
  if (response) return Buffer.from(await response.body());
  return Buffer.from(await page.content(), 'utf-8');
}
