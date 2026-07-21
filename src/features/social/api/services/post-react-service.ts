import type { DbOrTx } from '@/db';

import { findPostReactCrawlAdapter } from '../adapters/post-react/registry';
import type { ReactCrawlResult } from '../adapters/post-react/types';
import {
  getJobById,
  getOrCreateReactJob,
  getPostById,
  listPendingPostTargets,
  markJobDone,
  markJobFailed,
  markJobRunning,
  pickActiveScraperAccount,
  saveJobCursor,
  type PendingPostTarget,
  type ScraperAccount,
} from '../queries';

const BATCH_SIZE = 50;
const REACT_JOB_TYPE = 'react' as const;

export interface CrawlPostReactsInput {
  jobId: string;
  postId: string;
  postUrl: string;
  platformId: string;
  cookieId: string;
  startCursor: string | null;
}

export interface CrawlPostReactsResult extends ReactCrawlResult {}

export async function crawlPostReacts(
  db: DbOrTx,
  input: CrawlPostReactsInput,
): Promise<CrawlPostReactsResult> {
  await markJobRunning(db, input.jobId);

  const adapter = findPostReactCrawlAdapter(input.platformId);
  return adapter.crawlReacts({
    db,
    jobId: input.jobId,
    postId: input.postId,
    postUrl: input.postUrl,
    startCursor: input.startCursor,
    cookieId: input.cookieId,
    onProgress: () => undefined,
  });
}

export interface DispatchPostReactJob {
  postId: string;
  jobId: string;
  postUrl: string;
  platformId: string;
  cookieId: string;
}

export async function buildPostReactJobs(
  db: DbOrTx,
  limit: number = BATCH_SIZE,
): Promise<DispatchPostReactJob[]> {
  const targets = await listPendingPostTargets(db, limit);
  const jobs: DispatchPostReactJob[] = [];
  for (const { post } of targets) {
    const scraper = await pickActiveScraperAccount(db, post.platformId);
    if (!scraper) {
      console.warn(
        `[post-react] skip post ${post.id} — no active scraper account for platform ${post.platformId}`,
      );
      continue;
    }
    const jobId = await getOrCreateReactJob(db, post.id, REACT_JOB_TYPE);
    jobs.push({
      postId: post.id,
      jobId,
      postUrl: post.url,
      platformId: post.platformId,
      cookieId: scraper.cookie.id,
    });
  }
  return jobs;
}

export async function getJobCursor(db: DbOrTx, jobId: string): Promise<string | null> {
  const job = await getJobById(db, jobId);
  return job?.cursor ?? null;
}

export async function loadJobContext(
  db: DbOrTx,
  jobId: string,
): Promise<{
  postId: string;
  postUrl: string;
  platformId: string;
  startCursor: string | null;
} | null> {
  const job = await getJobById(db, jobId);
  if (!job) return null;
  const post = await getPostById(db, job.postId);
  if (!post) return null;
  return {
    postId: job.postId,
    postUrl: post.url,
    platformId: post.platformId,
    startCursor: job.cursor,
  };
}

export async function finishJob(
  db: DbOrTx,
  jobId: string,
  result: ReactCrawlResult,
): Promise<void> {
  if (result.finalCursor) {
    await saveJobCursor(db, jobId, result.finalCursor);
  }
  await markJobDone(db, jobId);
}

export async function failJob(db: DbOrTx, jobId: string, error: string): Promise<void> {
  await markJobFailed(db, jobId, error);
}

export type { PendingPostTarget, ScraperAccount };
