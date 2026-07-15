import { hostnameOf } from '@/lib/url';

import { requiresJsRender } from '../detect-js-required';
import { findPageExtractor } from '../extractors/factory';
import { createSilentJSDOM } from '../jsdom';
import type { CrawlResponse } from '../types';
import type { CrawlerAdapter } from './adapter';
import { BrowserlessContentAdapter } from './browserless-content';
import { FetchCrawlerAdapter } from './fetch';

const DOMAIN_BROWSER_TTL_MS = 60 * 60 * 1000;

/**
 * Fetch-first crawler with browser fallback. Inspired by Crawl4AI's
 * `fallback_fetch_function` pattern, inverted: try cheap, escalate on
 * signal that the page needs JS.
 */
export class CompositeCrawlerAdapter implements CrawlerAdapter {
  readonly name = 'composite';

  private readonly fetcher: FetchCrawlerAdapter;
  private readonly browser: BrowserlessContentAdapter;
  private readonly browserDomainCache = new Map<string, number>();

  constructor(_opts: { timeoutSecs?: number } = {}) {
    this.fetcher = new FetchCrawlerAdapter();
    this.browser = new BrowserlessContentAdapter();
  }

  async crawl(url: string): Promise<CrawlResponse> {
    const host = hostnameOf(url);
    if (host && this.hasBrowserDomain(host)) return this.browser.crawl(url);

    const fetched = await this.fetcher.crawl(url);
    if (findPageExtractor(fetched.contentType).name !== 'html') return fetched;

    const browserNeeded = this.parseAndDetect(fetched);

    if (host && browserNeeded) this.rememberBrowserDomain(host);
    return browserNeeded ? this.browser.crawl(url) : fetched;
  }

  async close(): Promise<void> {
    await this.fetcher.close();
    await this.browser.close();
  }

  private hasBrowserDomain(host: string): boolean {
    const insertedAt = this.browserDomainCache.get(host);
    if (insertedAt === undefined) return false;
    if (Date.now() - insertedAt > DOMAIN_BROWSER_TTL_MS) {
      this.browserDomainCache.delete(host);
      return false;
    }
    return true;
  }

  private rememberBrowserDomain(host: string): void {
    this.browserDomainCache.set(host, Date.now());
  }

  private parseAndDetect(response: CrawlResponse): boolean {
    const dom = createSilentJSDOM(
      typeof response.body === 'string' ? response.body : response.body.toString('utf-8'),
      { url: response.url },
    );
    return requiresJsRender(response, dom.window.document);
  }
}
