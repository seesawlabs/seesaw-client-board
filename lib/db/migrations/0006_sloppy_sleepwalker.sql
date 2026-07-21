ALTER TABLE "ingested_docs" ADD COLUMN "kind" text DEFAULT 'standup' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingested_docs" ADD COLUMN "modified_time" text DEFAULT '' NOT NULL;