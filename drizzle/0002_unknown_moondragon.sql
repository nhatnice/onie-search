CREATE TABLE "social"."post_crawl_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"cursor" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_crawl_jobs_post_type" UNIQUE("post_id","type")
);
--> statement-breakpoint
CREATE TABLE "social"."post_reacts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"post_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "post_reacts_account_post" UNIQUE("account_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "social"."posts" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"platform_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_url" UNIQUE("url")
);
--> statement-breakpoint
ALTER TABLE "social"."post_crawl_jobs" ADD CONSTRAINT "post_crawl_jobs_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "social"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social"."post_reacts" ADD CONSTRAINT "post_reacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "social"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social"."post_reacts" ADD CONSTRAINT "post_reacts_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "social"."posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social"."posts" ADD CONSTRAINT "posts_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "social"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_post_crawl_jobs_status" ON "social"."post_crawl_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_post_crawl_jobs_post" ON "social"."post_crawl_jobs" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_post_reacts_post" ON "social"."post_reacts" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_posts_platform" ON "social"."posts" USING btree ("platform_id");