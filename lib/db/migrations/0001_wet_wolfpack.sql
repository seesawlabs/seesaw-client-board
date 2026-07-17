CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"turn_id" text NOT NULL,
	"actor" text DEFAULT 'agent' NOT NULL,
	"tool" text NOT NULL,
	"summary" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" uuid,
	"before_image" jsonb,
	"undone" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"turn_id" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL
);
