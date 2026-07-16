ALTER TABLE "pages" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."page_status";--> statement-breakpoint
CREATE TYPE "public"."page_status" AS ENUM('pending', 'crawling', 'crawled', 'failed');--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "status" SET DEFAULT 'pending'::"public"."page_status";--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "status" SET DATA TYPE "public"."page_status" USING "status"::"public"."page_status";--> statement-breakpoint
ALTER TABLE "page_contents" DROP CONSTRAINT "page_contents_page_kind_mime_unique";--> statement-breakpoint
ALTER TABLE "page_contents" ADD CONSTRAINT "page_contents_page_kind_mime_unique" UNIQUE("page_id","kind","mime_type");