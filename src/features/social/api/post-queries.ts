import { and, asc, eq, isNull, or } from 'drizzle-orm';

import type { DbOrTx } from '@/db';

import {
  postCrawlJobs,
  postReacts,
  posts,
  type NewPost,
  type NewPostCrawlJob,
  type NewPostReact,
  type Post,
  type PostCrawlJob,
  type PostCrawlJobStatus,
  type PostCrawlJobType,
} from './post-schema';
import { accounts } from './schema';

export interface PendingPostTarget {
  post: Post;
}

export async function insertPost(db: DbOrTx, input: NewPost): Promise<void> {
  await db.insert(posts).values(input).onConflictDoNothing();
}

export async function getPostById(db: DbOrTx, id: string): Promise<Post | null> {
  const rows = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listPendingPostTargets(
  db: DbOrTx,
  limit: number,
): Promise<PendingPostTarget[]> {
  const rows = await db
    .select({ post: posts })
    .from(posts)
    .leftJoin(postCrawlJobs, eq(postCrawlJobs.postId, posts.id))
    .where(or(isNull(postCrawlJobs.id), eq(postCrawlJobs.status, 'failed')))
    .orderBy(asc(posts.createdAt))
    .limit(limit);
  return rows.map((r) => ({ post: r.post }));
}

// ─── post crawl jobs ──────────────────────────────────────────────────────────

export async function insertPostCrawlJob(db: DbOrTx, input: NewPostCrawlJob): Promise<void> {
  await db.insert(postCrawlJobs).values(input).onConflictDoNothing();
}

export async function getOrCreateReactJob(
  db: DbOrTx,
  postId: string,
  type: PostCrawlJobType = 'react',
): Promise<string> {
  const existing = await db
    .select()
    .from(postCrawlJobs)
    .where(and(eq(postCrawlJobs.postId, postId), eq(postCrawlJobs.type, type)))
    .limit(1);
  const row = existing[0];
  if (row) {
    if (row.status === 'pending' || row.status === 'running') {
      return row.id;
    }
    await db
      .update(postCrawlJobs)
      .set({
        status: 'pending',
        error: null,
        startedAt: null,
        finishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(postCrawlJobs.id, row.id));
    return row.id;
  }
  const id = crypto.randomUUID();
  await db.insert(postCrawlJobs).values({
    id,
    postId,
    type,
    status: 'pending',
  });
  return id;
}

export async function getJobById(db: DbOrTx, id: string): Promise<PostCrawlJob | null> {
  const rows = await db.select().from(postCrawlJobs).where(eq(postCrawlJobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function listPostCrawlJobsByPost(db: DbOrTx, postId: string): Promise<PostCrawlJob[]> {
  return db.select().from(postCrawlJobs).where(eq(postCrawlJobs.postId, postId));
}

export async function markJobRunning(db: DbOrTx, id: string): Promise<void> {
  await db
    .update(postCrawlJobs)
    .set({ status: 'running', startedAt: new Date(), updatedAt: new Date() })
    .where(eq(postCrawlJobs.id, id));
}

export async function markJobDone(db: DbOrTx, id: string): Promise<void> {
  await db
    .update(postCrawlJobs)
    .set({
      status: 'done',
      finishedAt: new Date(),
      error: null,
      cursor: null,
      updatedAt: new Date(),
    })
    .where(eq(postCrawlJobs.id, id));
}

export async function markJobFailed(db: DbOrTx, id: string, error: string): Promise<void> {
  await db
    .update(postCrawlJobs)
    .set({
      status: 'failed',
      finishedAt: new Date(),
      error,
      updatedAt: new Date(),
    })
    .where(eq(postCrawlJobs.id, id));
}

export async function saveJobCursor(db: DbOrTx, id: string, cursor: string | null): Promise<void> {
  await db
    .update(postCrawlJobs)
    .set({ cursor, updatedAt: new Date() })
    .where(eq(postCrawlJobs.id, id));
}

// ─── post reacts ──────────────────────────────────────────────────────────────

export interface UpsertReactorInput {
  platformUserId: string;
  platformId: string;
}

export async function upsertReactorAccount(db: DbOrTx, input: UpsertReactorInput): Promise<string> {
  const id = crypto.randomUUID();
  const inserted = await db
    .insert(accounts)
    .values({
      id,
      platformUserId: input.platformUserId,
      platformId: input.platformId,
    })
    .onConflictDoNothing({ target: [accounts.platformUserId, accounts.platformId] })
    .returning({ id: accounts.id });
  if (inserted[0]) return inserted[0].id;
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.platformUserId, input.platformUserId),
        eq(accounts.platformId, input.platformId),
        isNull(accounts.deletedAt),
      ),
    )
    .limit(1);
  if (!existing[0]) {
    throw new Error(
      `upsertReactorAccount: row missing after conflict for ${input.platformUserId}/${input.platformId}`,
    );
  }
  return existing[0].id;
}

export async function insertPostReact(db: DbOrTx, input: NewPostReact): Promise<void> {
  await db.insert(postReacts).values(input).onConflictDoNothing();
}

export async function insertPostReactsBulk(db: DbOrTx, rows: NewPostReact[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(postReacts).values(rows).onConflictDoNothing();
}

export type { PostCrawlJobStatus, PostCrawlJobType };

export const POST_CRAWL_JOB_TYPES: readonly PostCrawlJobType[] = ['react', 'comment'] as const;
export const POST_CRAWL_JOB_STATUSES: readonly PostCrawlJobStatus[] = [
  'pending',
  'running',
  'done',
  'failed',
] as const;
