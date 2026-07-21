CREATE TABLE "slack_cursors" (
	"channel_id" text PRIMARY KEY NOT NULL,
	"last_ts" text DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
