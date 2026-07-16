ALTER TYPE "crawler"."link_type" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "crawler"."page_content_kind" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "crawler"."page_status" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "crawler"."feed_status" SET SCHEMA "public";--> statement-breakpoint
ALTER TYPE "crawler"."feed_type" SET SCHEMA "public";--> statement-breakpoint
ALTER TABLE "crawler"."page_contents" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "crawler"."page_links" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "crawler"."page_metadata" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "crawler"."pages" SET SCHEMA "public";
--> statement-breakpoint
ALTER TABLE "crawler"."feeds" SET SCHEMA "public";
