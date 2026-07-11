ALTER TABLE "page_links" ALTER COLUMN "linkType" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."link_type";--> statement-breakpoint
CREATE TYPE "public"."link_type" AS ENUM('sitemap', 'internal', 'outbound');--> statement-breakpoint
ALTER TABLE "page_links" ALTER COLUMN "linkType" SET DATA TYPE "public"."link_type" USING "linkType"::"public"."link_type";--> statement-breakpoint
DROP INDEX "idx_pages_parent";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "parent_page_id";