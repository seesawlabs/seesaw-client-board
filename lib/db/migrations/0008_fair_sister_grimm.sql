CREATE TABLE "github_cursors" (
	"repo" text PRIMARY KEY NOT NULL,
	"last_sync" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "github_repo" text DEFAULT '' NOT NULL;