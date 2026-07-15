CREATE TYPE "public"."page_content_kind" AS ENUM('page', 'media', 'file');--> statement-breakpoint
DROP TABLE "page_contents";--> statement-breakpoint
CREATE TABLE "page_contents" (
	"id" text PRIMARY KEY NOT NULL,
	"page_id" text NOT NULL,
	"kind" "page_content_kind" NOT NULL,
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
ALTER TABLE "page_contents" ADD CONSTRAINT "page_contents_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_page_contents_page" ON "page_contents" USING btree ("page_id");--> statement-breakpoint
CREATE INDEX "idx_page_contents_hash" ON "page_contents" USING btree ("blob_hash");
