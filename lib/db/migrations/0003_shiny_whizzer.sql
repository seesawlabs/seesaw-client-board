CREATE TABLE "integrations" (
	"provider" text PRIMARY KEY NOT NULL,
	"refresh_token" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"scope" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now()
);
