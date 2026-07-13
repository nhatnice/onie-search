import { Buffer } from 'node:buffer';

import {
  chromium,
  type Browser,
  type BrowserContext,
  type Page,
  type Response as PlaywrightResponse,
} from 'playwright';

import type { CrawlResponse } from '../types';
import type { CrawlerAdapter } from './adapter';

export interface PlaywrightAdapterOptions {
  headless?: boolean;
  timeoutSecs?: number;
}

const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'stylesheet']);

export class PlaywrightCrawlerAdapter implements CrawlerAdapter {
  readonly name = 'playwright';

  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private readonly headless: boolean;
  private readonly timeoutMs: number;
  private launchPromise: Promise<Browser> | undefined;

  constructor(opts: PlaywrightAdapterOptions = {}) {
    this.headless = opts.headless ?? true;
    this.timeoutMs = (opts.timeoutSecs ?? 30) * 1000;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    if (!this.launchPromise) {
      // ponytail: --no-sandbox required when running as non-root in containers (Docker/CI).
      // Drop args if running outside Docker and sandbox is desired.
      this.launchPromise = chromium
        .launch({
          headless: this.headless,
          args:
            process.env.NODE_ENV === 'production'
              ? ['--no-sandbox', '--disable-setuid-sandbox']
              : [],
        })
        .then((b) => {
          this.browser = b;
          this.launchPromise = undefined;
          return b;
        });
    }
    return this.launchPromise;
  }

  private async getContext(): Promise<BrowserContext> {
    if (this.context) return this.context;
    const browser = await this.getBrowser();
    this.context = await browser.newContext();
    installAssetBlocker(this.context);
    return this.context;
  }

  async crawl(url: string): Promise<CrawlResponse> {
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

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close().catch(() => undefined);
      this.context = undefined;
    }
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = undefined;
    }
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
