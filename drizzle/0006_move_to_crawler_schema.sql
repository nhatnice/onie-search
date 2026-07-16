CREATE SCHEMA IF NOT EXISTS "crawler";--> statement-breakpoint
ALTER TYPE "public"."feed_type" SET SCHEMA "crawler";--> statement-breakpoint
ALTER TYPE "public"."feed_status" SET SCHEMA "crawler";--> statement-breakpoint
ALTER TYPE "public"."link_type" SET SCHEMA "crawler";--> statement-breakpoint
ALTER TYPE "public"."page_status" SET SCHEMA "crawler";--> statement-breakpoint
ALTER TYPE "public"."page_content_kind" SET SCHEMA "crawler";--> statement-breakpoint
ALTER TABLE "public"."feeds" SET SCHEMA "crawler";--> statement-breakpoint
ALTER TABLE "public"."pages" SET SCHEMA "crawler";--> statement-breakpoint
ALTER TABLE "public"."page_metadata" SET SCHEMA "crawler";--> statement-breakpoint
ALTER TABLE "public"."page_contents" SET SCHEMA "crawler";--> statement-breakpoint
ALTER TABLE "public"."page_links" SET SCHEMA "crawler";