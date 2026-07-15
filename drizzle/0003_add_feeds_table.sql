CREATE TYPE "public"."feed_type" AS ENUM('sitemap', 'rss', 'atom', 'json_feed');--> statement-breakpoint
CREATE TYPE "public"."feed_status" AS ENUM('pending', 'scanning', 'scanned', 'failed');--> statement-breakpoint
CREATE TABLE "feeds" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"type" "feed_type" NOT NULL,
	"status" "feed_status" DEFAULT 'pending' NOT NULL,
	"last_scanned_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "feeds_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE INDEX "idx_feeds_status" ON "feeds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_feeds_last_scanned" ON "feeds" USING btree ("last_scanned_at");--> statement-breakpoint
CREATE INDEX "idx_feeds_url" ON "feeds" USING btree ("url");
