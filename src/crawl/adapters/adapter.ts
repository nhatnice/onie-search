import type { CrawlResponse } from '../types';

export interface CrawlerAdapter {
  readonly name: string;
  /** Fetch a URL and return the raw response (status, headers, body). */
  crawl(url: string): Promise<CrawlResponse>;
  close(): Promise<void>;
}
