CREATE SCHEMA IF NOT EXISTS crawler;

CREATE TYPE "crawler"."link_type" AS ENUM('sitemap', 'internal', 'outbound');--> statement-breakpoint
CREATE TYPE "crawler"."page_content_kind" AS ENUM('page', 'media', 'file');--> statement-breakpoint
CREATE TYPE "crawler"."page_status" AS ENUM('pending', 'crawling', 'crawled', 'failed');--> statement-breakpoint
CREATE TYPE "crawler"."feed_status" AS ENUM('pending', 'scanning', 'scanned', 'failed');--> statement-breakpoint
CREATE TYPE "crawler"."feed_type" AS ENUM('sitemap', 'rss', 'atom', 'json_feed');--> statement-breakpoint
CREATE TABLE "crawler"."page_contents" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"kind" "crawler"."page_content_kind" NOT NULL,
	"mime_type" text NOT NULL,
	"blob_path" text NOT NULL,
	"blob_size" integer NOT NULL,
	"blob_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "page_contents_page_kind_mime_unique" UNIQUE("page_id","kind","mime_type")
);
--> statement-breakpoint
CREATE TABLE "crawler"."page_links" (
	"id" text PRIMARY KEY NOT NULL,
	"source_page_id" text NOT NULL,
	"target_page_id" text NOT NULL,
	"link_type" "crawler"."link_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler"."page_metadata" (
	"page_id" text PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"thumbnail" text,
	"favicon" text,
	"json_ld" jsonb,
	"language" text,
	"author" text,
	"published_at" text,
	"modified_at" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawler"."pages" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"status" "crawler"."page_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"crawled_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "pages_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "crawler"."feeds" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"type" "crawler"."feed_type" NOT NULL,
	"status" "crawler"."feed_status" DEFAULT 'pending' NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "feeds_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "crawler"."page_contents" ADD CONSTRAINT "page_contents_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "crawler"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler"."page_links" ADD CONSTRAINT "page_links_source_page_id_pages_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "crawler"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler"."page_links" ADD CONSTRAINT "page_links_target_page_id_pages_id_fk" FOREIGN KEY ("target_page_id") REFERENCES "crawler"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawler"."page_metadata" ADD CONSTRAINT "page_metadata_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "crawler"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_page_contents_page" ON "crawler"."page_contents" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_page_contents_hash" ON "crawler"."page_contents" USING btree ("blob_hash");--> statement-breakpoint
CREATE INDEX "idx_links_source" ON "crawler"."page_links" USING btree ("source_page_id");--> statement-breakpoint
CREATE INDEX "idx_links_target" ON "crawler"."page_links" USING btree ("target_page_id");--> statement-breakpoint
CREATE INDEX "idx_pages_status" ON "crawler"."pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pages_url" ON "crawler"."pages" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_feeds_status" ON "crawler"."feeds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_feeds_last_scanned" ON "crawler"."feeds" USING btree ("last_scanned_at");--> statement-breakpoint
CREATE INDEX "idx_feeds_url" ON "crawler"."feeds" USING btree ("url");