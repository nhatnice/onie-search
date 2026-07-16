import { index, integer, jsonb, pgSchema, text, timestamp, unique } from 'drizzle-orm/pg-core';

const crawlerSchema = pgSchema('crawler');

export const pageStatusEnum = crawlerSchema.enum('page_status', [
  'pending',
  'crawling',
  'crawled',
  'failed',
]);

export const linkTypeEnum = crawlerSchema.enum('link_type', ['sitemap', 'internal', 'outbound']);

export const pageContentKindEnum = crawlerSchema.enum('page_content_kind', [
  'page',
  'media',
  'file',
]);

export const pages = crawlerSchema.table(
  'pages',
  {
    id: text('id').primaryKey(),
    url: text('url').notNull().unique(),
    status: pageStatusEnum().notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    crawledAt: timestamp('crawled_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [index('idx_pages_status').on(t.status), index('idx_pages_url').on(t.url)],
);

export const pageMetadata = crawlerSchema.table('page_metadata', {
  pageId: text('page_id')
    .primaryKey()
    .references(() => pages.id),
  title: text('title'),
  description: text('description'),
  thumbnail: text('thumbnail'),
  favicon: text('favicon'),
  jsonLd: jsonb('json_ld'),
  language: text('language'),
  author: text('author'),
  publishedAt: text('published_at'),
  modifiedAt: text('modified_at'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pageContents = crawlerSchema.table(
  'page_contents',
  {
    id: text('id').primaryKey(),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id),
    kind: pageContentKindEnum().notNull(),
    mimeType: text('mime_type').notNull(),
    blobPath: text('blob_path').notNull(),
    blobSize: integer('blob_size').notNull(),
    blobHash: text('blob_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    unique('page_contents_page_kind_mime_unique').on(t.pageId, t.kind, t.mimeType),
    index('idx_page_contents_page').on(t.pageId),
    index('idx_page_contents_hash').on(t.blobHash),
  ],
);

export const pageLinks = crawlerSchema.table(
  'page_links',
  {
    id: text('id').primaryKey(),
    sourcePageId: text('source_page_id')
      .notNull()
      .references(() => pages.id),
    targetPageId: text('target_page_id')
      .notNull()
      .references(() => pages.id),
    linkType: linkTypeEnum('link_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('idx_links_source').on(t.sourcePageId),
    index('idx_links_target').on(t.targetPageId),
  ],
);

export type Page = typeof pages.$inferSelect;
export type NewPage = typeof pages.$inferInsert;
export type PageMetadata = typeof pageMetadata.$inferSelect;
export type PageContent = typeof pageContents.$inferSelect;
export type PageLink = typeof pageLinks.$inferSelect;
