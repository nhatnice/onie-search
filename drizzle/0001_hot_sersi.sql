CREATE SCHEMA IF NOT EXISTS "social";--> statement-breakpoint
CREATE TABLE "social"."platforms" (
	"id" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"platform_user_id" text NOT NULL,
	"platform_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "accounts_platform_user" UNIQUE("platform_user_id","platform_id")
);
--> statement-breakpoint
CREATE TABLE "social"."cookies" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"cookie" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"error" text,
	"last_refreshed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "cookies_account" UNIQUE("account_id")
);
--> statement-breakpoint
ALTER TABLE "social"."accounts" ADD CONSTRAINT "accounts_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "social"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social"."cookies" ADD CONSTRAINT "cookies_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "social"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_platform" ON "social"."accounts" USING btree ("platform_id");--> statement-breakpoint
CREATE INDEX "idx_cookies_status" ON "social"."cookies" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cookies_last_refreshed" ON "social"."cookies" USING btree ("last_refreshed_at");--> statement-breakpoint
CREATE INDEX "idx_cookies_account" ON "social"."cookies" USING btree ("account_id");--> statement-breakpoint
INSERT INTO "social"."platforms" ("id") VALUES ('facebook'), ('instagram'), ('tiktok');
