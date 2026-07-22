CREATE TABLE "social"."account_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"type" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "account_contacts_account_type" UNIQUE("account_id","type")
);
--> statement-breakpoint
ALTER TABLE "social"."account_contacts" ADD CONSTRAINT "account_contacts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "social"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_account_contacts_account" ON "social"."account_contacts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_account_contacts_type" ON "social"."account_contacts" USING btree ("type");