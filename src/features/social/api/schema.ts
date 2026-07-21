import { index, text, timestamp, unique } from 'drizzle-orm/pg-core';

import { socialSchema } from '@/db/social-schema';

export const platforms = socialSchema.table('platforms', {
  id: text('id').primaryKey(),
});

export const accounts = socialSchema.table(
  'accounts',
  {
    id: text('id').primaryKey(),
    platformUserId: text('platform_user_id').notNull(),
    platformId: text('platform_id')
      .notNull()
      .references(() => platforms.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    unique('accounts_platform_user').on(t.platformUserId, t.platformId),
    index('idx_accounts_platform').on(t.platformId),
  ],
);

export const cookies = socialSchema.table(
  'cookies',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id')
      .notNull()
      .references(() => accounts.id),
    cookie: text('cookie').notNull(),
    status: text('status').notNull().default('active'),
    error: text('error'),
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    unique('cookies_account').on(t.accountId),
    index('idx_cookies_status').on(t.status),
    index('idx_cookies_last_refreshed').on(t.lastRefreshedAt),
    index('idx_cookies_account').on(t.accountId),
  ],
);

export type Platform = typeof platforms.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Cookie = typeof cookies.$inferSelect;
export type NewCookie = typeof cookies.$inferInsert;
export type CookieStatus = 'active' | 'dead';
export type SocialPlatform = string;
