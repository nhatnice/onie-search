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

export interface Reactor {
  uid?: string;
  name?: string;
  profileUrl?: string;
  'User Id'?: string;
  Username?: string;
  'Profile URL'?: string;
  'Avatar URL'?: string;
  'Reaction Type'?: string;
  'Friendship Status'?: string;
  'Subscribe Status'?: string;
  'Mutual Friends Number'?: number;
}

export interface ReactProgress {
  page: number;
  total: number;
  hasNext: boolean;
  cursor: string | null;
  pageReactors?: Reactor[];
}
