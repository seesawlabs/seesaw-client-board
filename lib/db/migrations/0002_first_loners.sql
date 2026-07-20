CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"drive_folder_id" text DEFAULT '' NOT NULL,
	"slack_internal" text DEFAULT '' NOT NULL,
	"slack_external" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "account_id" uuid;