CREATE TABLE "ingested_docs" (
	"doc_id" text PRIMARY KEY NOT NULL,
	"account_id" uuid,
	"title" text DEFAULT '' NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now()
);
