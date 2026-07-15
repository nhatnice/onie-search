import { index, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const feedTypeEnum = pgEnum('feed_type', ['sitemap', 'rss', 'atom', 'json_feed']);

export const feedStatusEnum = pgEnum('feed_status', ['pending', 'scanning', 'scanned', 'failed']);

export const feeds = pgTable(
  'feeds',
  {
    id: text('id').primaryKey(),
    url: text('url').notNull().unique(),
    type: feedTypeEnum().notNull(),
    status: feedStatusEnum().notNull().default('pending'),
    lastScannedAt: timestamp('last_scanned_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    index('idx_feeds_status').on(t.status),
    index('idx_feeds_last_scanned').on(t.lastScannedAt),
    index('idx_feeds_url').on(t.url),
  ],
);

export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type FeedType = (typeof feedTypeEnum.enumValues)[number];
export type FeedStatus = (typeof feedStatusEnum.enumValues)[number];
