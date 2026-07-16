import { pgTable, uuid, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import type { Assignment, StepInstance } from "@/lib/types";

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
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
