import type { DbOrTx } from '@/db';

export interface ReactCrawlInput {
  db: DbOrTx;
  jobId: string;
  postId: string;
  postUrl: string;
  startCursor: string | null;
  cookieId: string;
  onProgress?: (count: number) => void;
}

export interface ReactCrawlResult {
  reactors: number;
  finalCursor: string | null;
}

export interface PostReactCrawlAdapter {
  readonly platform: string;
  crawlReacts(input: ReactCrawlInput): Promise<ReactCrawlResult>;
}
