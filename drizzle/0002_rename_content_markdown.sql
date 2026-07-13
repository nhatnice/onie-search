ALTER TABLE "page_contents" RENAME COLUMN "content_markdown" TO "raw_markdown";--> statement-breakpoint
ALTER TABLE "page_contents" ADD COLUMN "clean_markdown" text;