import { index, text, timestamp, unique } from 'drizzle-orm/pg-core';

import { socialSchema } from '@/db/social-schema';

export const posts = socialSchema.table(
  'posts',
  {
    id: text('id').primaryKey(),
    url: text('url').notNull(),
    platformId: text('platform_id')
      .notNull()
      .references(() => platforms.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique('posts_url').on(t.url), index('idx_posts_platform').on(t.platformId)],
);

export const postCrawlJobs = socialSchema.table(
  'post_crawl_jobs',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id),
    type: text('type').notNull(),
    status: text('status').notNull().default('pending'),
    error: text('error'),
    cursor: text('cursor'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('post_crawl_jobs_post_type').on(t.postId, t.type),
    index('idx_post_crawl_jobs_status').on(t.status),
    index('idx_post_crawl_jobs_post').on(t.postId),
  ],
);

export const postReacts = socialSchema.table(
  'post_reacts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('post_reacts_account_post').on(t.accountId, t.postId),
    index('idx_post_reacts_post').on(t.postId),
  ],
);

import { accounts, platforms } from './schema';

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostCrawlJob = typeof postCrawlJobs.$inferSelect;
export type NewPostCrawlJob = typeof postCrawlJobs.$inferInsert;
export type PostReact = typeof postReacts.$inferSelect;
export type NewPostReact = typeof postReacts.$inferInsert;
export type PostCrawlJobType = 'react' | 'comment';
export type PostCrawlJobStatus = 'pending' | 'running' | 'done' | 'failed';
