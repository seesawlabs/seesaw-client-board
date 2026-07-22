ALTER TABLE "clients" ADD COLUMN "brief_prose" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "brief_attention" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "brief_at" timestamp with time zone;