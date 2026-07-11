CREATE TYPE "public"."link_type" AS ENUM('sitemap', 'internal', 'outbound', 'backlink', 'href');--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('pending', 'crawling', 'crawled', 'failed', 'external');--> statement-breakpoint
CREATE TABLE "page_contents" (
	"page_id" text PRIMARY KEY NOT NULL,
	"content_markdown" text,
	"clean_html" text,
	"raw_html" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_links" (
	"id" text PRIMARY KEY NOT NULL,
	"source_page_id" text NOT NULL,
	"target_page_id" text NOT NULL,
	"linkType" "link_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_metadata" (
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
CREATE TABLE "pages" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"parent_page_id" text,
	"status" "page_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"crawled_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "pages_url_unique" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "page_contents" ADD CONSTRAINT "page_contents_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_source_page_id_pages_id_fk" FOREIGN KEY ("source_page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_links" ADD CONSTRAINT "page_links_target_page_id_pages_id_fk" FOREIGN KEY ("target_page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_metadata" ADD CONSTRAINT "page_metadata_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_links_source" ON "page_links" USING btree ("source_page_id");--> statement-breakpoint
CREATE INDEX "idx_links_target" ON "page_links" USING btree ("target_page_id");--> statement-breakpoint
CREATE INDEX "idx_pages_status" ON "pages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_pages_url" ON "pages" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_pages_parent" ON "pages" USING btree ("parent_page_id");