import { pgTable, uuid, text, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import type { Assignment, StepInstance } from "@/lib/types";

// NAMING (historical): the `clients` table below is actually the ENGAGEMENT /
// PROJECT (the unit of work — one 5D process). The `accounts` table is the
// CLIENT / company that groups projects. UI labels: account → "Client",
// clients row → "Project". A client (account) can have many projects.
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  driveFolderId: text("drive_folder_id").notNull().default(""),
  slackInternal: text("slack_internal").notNull().default(""),
  slackExternal: text("slack_external").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  accountId: uuid("account_id"), // → accounts.id (the grouping client/company)
  name: text("name").notNull(),
  summary: text("summary").notNull().default(""),
  start: text("start").notNull().default(""),
  end: text("end").notNull().default(""),
  phase: text("phase").notNull().default("Discover"),
  status: text("status").notNull().default("On Track"),
  billing: text("billing").notNull().default("billable"),
  contractValue: integer("contract_value"),
  buildUrl: text("build_url").notNull().default(""),
  opportunity: jsonb("opportunity").$type<{ types: string[]; note: string }>().notNull().default({ types: [], note: "" }),
  assignments: jsonb("assignments").$type<Assignment[]>().notNull().default([]),
  risks: jsonb("risks").$type<string[]>().notNull().default([]),
  needs: jsonb("needs").$type<string[]>().notNull().default([]),
  findings: jsonb("findings").$type<string[]>().notNull().default([]),
  links: jsonb("links").$type<{ label: string; url: string }[]>().notNull().default([]),
  entryPoint: jsonb("entry_point").$type<{ mode: "greenfield" | "mid-build"; atStep: string | null }>().notNull().default({ mode: "greenfield", atStep: null }),
  process: jsonb("process").$type<Record<string, StepInstance>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const opportunities = pgTable("opportunities", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  industry: text("industry").notNull().default(""),
  stage: text("stage").notNull().default("Lead"),
  contact: text("contact").notNull().default(""),
  notes: text("notes").notNull().default(""),
  expertiseAsk: text("expertise_ask").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

export const activity = pgTable("activity", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  turnId: text("turn_id").notNull(),
  actor: text("actor").notNull().default("agent"), // "agent" | "user"
  tool: text("tool").notNull(),                     // e.g. "setStep", "upsertClient", "undo"
  summary: text("summary").notNull(),               // human string for the feed
  entity: text("entity").notNull(),                 // "client" | "opportunity"
  entityId: uuid("entity_id"),                      // affected row id (null before a create resolves)
  beforeImage: jsonb("before_image"),               // full prior row, or null for a create
  undone: boolean("undone").notNull().default(false),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  turnId: text("turn_id").notNull(),
  role: text("role").notNull(),   // "user" | "assistant"
  content: text("content").notNull(),
});

// Docs (standup transcripts) already ingested, so we don't re-process them.
export const ingestedDocs = pgTable("ingested_docs", {
  docId: text("doc_id").primaryKey(),
  accountId: uuid("account_id"),
  title: text("title").notNull().default(""),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow(),
});

// Per-Slack-channel read cursor: the ts of the newest message we've already
// ingested, so each run only pulls what's new (conversations.history oldest=).
export const slackCursors = pgTable("slack_cursors", {
  channelId: text("channel_id").primaryKey(),
  lastTs: text("last_ts").notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// Connected third-party integrations. One row per provider (e.g. "google").
// Holds the long-lived refresh token; access tokens are fetched on demand.
export const integrations = pgTable("integrations", {
  provider: text("provider").primaryKey(), // "google"
  refreshToken: text("refresh_token").notNull(),
  email: text("email").notNull().default(""),
  scope: text("scope").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});
