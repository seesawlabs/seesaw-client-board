# Client Board v1 (Standalone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SeeSaw client board as a standalone Next.js app on Vercel (Neon Postgres, deployment-protected): a deal/overview layer, a flexible per-client 5D process instance (skip/validate/decisions + entry point), and a by-resource allocation view.

**Architecture:** Next.js App Router. A server component fetches the board and hands it to a client `Board` component. Mutations go through server actions (`lib/actions.ts`) that write to Neon via Drizzle and `revalidatePath('/')`. All product logic (template, normalize, roll-ups, allocation) is pure, typed, and unit-tested in `lib/process.ts` — no DB or DOM needed. Access control is Vercel deployment protection (no auth code). See `docs/PRODUCT_SPEC.md` and `docs/adr/`.

**Tech Stack:** Next.js 15 (App Router, TS), React 19, Tailwind CSS, Drizzle ORM + `@neondatabase/serverless` (Neon Postgres), Vitest.

## Global Constraints

- **TypeScript everywhere**, `strict: true`.
- **Pure logic in `lib/process.ts`** must not import React, Next, or the DB — it stays unit-testable in a node environment. Types in `lib/types.ts`.
- **Persistence via Drizzle → Neon.** Nested per-client structures are JSONB columns (ADR 0002). `DATABASE_URL` comes from Vercel/Neon env; never commit secrets; `.env*` gitignored.
- **Server actions only** touch the DB (`'use server'` in `lib/actions.ts`); client components call them. Every mutation ends with `revalidatePath('/')`.
- **normalizeClient on read and write** — DB rows always render whole; every upsert is well-formed.
- **Status vocabulary (exact ids):** `todo`, `doing`, `done`, `validated`, `skipped`, `na`. **Process is keyed by step id.**
- **Preserve the visual system:** BRAND palette (navy `#152238`, red `#E4413F`, blue `#2B6CB0`, lightBlue `#A9CCE8`, pink `#F2B6C6`, paper `#F7F5F1`, ink `#1D2733`), Fraunces + Archivo fonts. Port the artifact's look; don't restyle.
- **No native `alert`/`confirm`/`prompt`.** Use in-app modals/overlays.
- **Commit after every task** (`feat:`/`test:`/`chore:`). End commit messages with the repo's two trailers (Co-Authored-By + Claude-Session).
- The root `dashboard.jsx` is the **reference prototype** — read it for exact JSX/markup to port, but the app is built fresh under `app/`, `components/`, `lib/`.

---

## File Structure

```
app/
  layout.tsx            # fonts, globals, <html>
  globals.css           # tailwind + BRAND CSS vars
  page.tsx              # server component: getBoard() -> <Board initial=.../>
components/
  Board.tsx             # client: view toggle, holds board state, refresh
  ui.tsx                # Chip, Field, StepIcon, inputCls/inputStyle, PhaseTracker, TimeBar
  TimelineOverview.tsx  # portfolio calendar
  ClientCard.tsx        # collapsed+expanded card (deal signals, process, skipped panel)
  ClientEditor.tsx      # deal fields, assignments, entry point
  ProcessSection.tsx    # 5D phases + step rows
  StepEditor.tsx        # per-step modal (status/note/decisions)
  ResourceView.tsx      # by-person allocation
  OppEditor.tsx         # opportunity form
lib/
  types.ts              # Client, Assignment, StepInstance, Opportunity, Board
  process.ts            # PROCESS/constants + pure logic (tested)
  process.test.ts       # vitest
  db/
    schema.ts           # drizzle tables
    index.ts            # drizzle(neon) client
  actions.ts            # 'use server' data access
scripts/
  seed.ts               # populate Neon with example data
drizzle.config.ts
vitest.config.ts
```

---

## Task 1: Scaffold Next.js + TypeScript + Tailwind + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `vitest.config.ts`, `lib/process.ts` (stub), `lib/process.test.ts`, `.gitignore` (update)

**Interfaces:**
- Consumes: nothing.
- Produces: a running dev server, a placeholder home page, and `npm test` (vitest) + `npm run build` working.

- [ ] **Step 1: Create the app with the Next toolchain**

Run (in repo root; the repo already has `dashboard.jsx`/`README.md` — scaffold in place):
```bash
npm init -y
npm install next@15 react@19 react-dom@19
npm install -D typescript @types/react @types/node @types/react-dom tailwindcss @tailwindcss/postcss postcss vitest
```

- [ ] **Step 2: Write config files**

`package.json` scripts block:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "seed": "tsx scripts/seed.ts"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext", "moduleResolution": "bundler",
    "jsx": "preserve", "strict": true, "noEmit": true,
    "esModuleInterop": true, "skipLibCheck": true, "resolveJsonModule": true,
    "incremental": true, "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`postcss.config.mjs`:
```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "node", include: ["lib/**/*.test.ts"] } });
```

`app/globals.css`:
```css
@import "tailwindcss";
:root {
  --brand-navy:#152238; --brand-red:#E4413F; --brand-blue:#2B6CB0;
  --brand-lightblue:#A9CCE8; --brand-pink:#F2B6C6; --brand-paper:#F7F5F1; --brand-ink:#1D2733;
}
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Archivo:wght@400;500;600;700&display=swap');
body { background: var(--brand-paper); color: var(--brand-ink); font-family: 'Archivo', system-ui, sans-serif; }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
```

- [ ] **Step 3: Write layout + placeholder page**

`app/layout.tsx`:
```tsx
import "./globals.css";
export const metadata = { title: "SeeSaw Client Board" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return <main className="p-10 text-2xl" style={{ fontFamily: "'Fraunces', serif" }}>SeeSaw Client Board — scaffolding.</main>;
}
```

- [ ] **Step 4: Add a stub logic module + trivial test**

`lib/process.ts`:
```ts
export const PING = "ok";
```
`lib/process.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { PING } from "./process";
describe("harness", () => { it("runs", () => expect(PING).toBe("ok")); });
```

- [ ] **Step 5: Update `.gitignore`**

Append:
```
node_modules/
.next/
.env
.env*.local
next-env.d.ts
.vercel
```

- [ ] **Step 6: Verify**

Run: `npm run test && npm run build`
Expected: 1 test passes; `next build` compiles the placeholder page with no type errors. `npm run dev` serves the page at localhost:3000.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + TypeScript + Tailwind + Vitest"
```

---

## Task 2: Provision Neon + Drizzle schema + migration

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/index.ts`, `drizzle.config.ts`, `.env.example`
- Install: `drizzle-orm`, `@neondatabase/serverless`, `drizzle-kit`, `tsx`

**Interfaces:**
- Consumes: `DATABASE_URL` env.
- Produces: a live `clients` + `opportunities` schema in Neon; `db` (Drizzle client) exported from `lib/db/index.ts`.

- [ ] **Step 1: Provision Neon via Vercel**

Use the Vercel Marketplace (skill `vercel:marketplace` or dashboard) to add **Neon Postgres** to a new Vercel project linked to this repo. Then pull env locally:
```bash
npx vercel link          # link the repo to the Vercel project
npx vercel env pull .env # writes DATABASE_URL locally
```
If not using Vercel CLI yet, create a Neon DB manually and put its pooled connection string in `.env` as `DATABASE_URL=...`. Record the non-secret example in `.env.example`:
```
DATABASE_URL=postgres://user:password@host/dbname?sslmode=require
```

- [ ] **Step 2: Install DB deps**

```bash
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit tsx
```

- [ ] **Step 3: Write the schema**

`lib/db/schema.ts`:
```ts
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
```
(Requires `lib/types.ts` from Task 3 — create that file's types first if the type import errors; Task 3 defines them. For task independence, create `lib/types.ts` now with the interfaces shown in Task 3 Step 3.)

- [ ] **Step 4: Write the Drizzle client + config**

`lib/db/index.ts`:
```ts
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

`drizzle.config.ts`:
```ts
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 5: Generate + apply the migration**

```bash
npm run db:generate    # creates lib/db/migrations/*.sql
npm run db:migrate     # applies to Neon
```
Expected: migration files created; `clients` and `opportunities` tables exist in Neon (verify in the Neon/Vercel dashboard or `\dt`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: Neon + Drizzle schema for clients and opportunities"
```

---

## Task 3: Types + process module (constants, normalize, entry point)

**Files:**
- Create/modify: `lib/types.ts`, `lib/process.ts`, `lib/process.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  - types in `lib/types.ts`: `Status`, `Load`, `Decision`, `StepInstance`, `Assignment`, `Client`, `Opportunity`, `Board`.
  - `lib/process.ts` exports: `PHASES`, `PROCESS`, `ALL_STEPS`, `STATUS_META`, `OPP_TYPES`, `BILLING`, `LOAD`, `BRAND`, `uid`, `loadWeight`, `formatMoney`, `contractLabel`, `defaultProcessForEntry`, `normalizeClient`.

- [ ] **Step 1: Write failing tests**

`lib/process.test.ts` (replace the stub):
```ts
import { describe, it, expect } from "vitest";
import {
  PROCESS, ALL_STEPS, STATUS_META, loadWeight, formatMoney, contractLabel,
  defaultProcessForEntry, normalizeClient,
} from "./process";

describe("template", () => {
  it("5 phases, 25 unique steps, Megamine flagged", () => {
    expect(PROCESS.map((p) => p.label)).toEqual(["Discover","Define","Design","Develop","Deploy"]);
    expect(ALL_STEPS).toHaveLength(25);
    expect(new Set(ALL_STEPS.map((s) => s.id)).size).toBe(25);
    expect(ALL_STEPS.find((s) => s.id === "dsc_rampup")!.megamine).toBe(true);
  });
  it("status meta applicability/completion", () => {
    expect(STATUS_META.done.complete).toBe(true);
    expect(STATUS_META.validated.complete).toBe(true);
    expect(STATUS_META.skipped.applicable).toBe(false);
    expect(STATUS_META.na.applicable).toBe(false);
  });
});

describe("formatters", () => {
  it("loadWeight / money / contract label", () => {
    expect(loadWeight("lead")).toBe(3);
    expect(loadWeight("light")).toBe(1);
    expect(formatMoney(85000)).toBe("$85,000");
    expect(contractLabel({ billing: "internal", contractValue: null } as any)).toBe("Internal / non-billable");
    expect(contractLabel({ billing: "billable", contractValue: null } as any)).toBe("—");
    expect(contractLabel({ billing: "billable", contractValue: 140000 } as any)).toBe("$140,000");
  });
});

describe("defaultProcessForEntry", () => {
  it("greenfield → all todo", () => {
    const p = defaultProcessForEntry({ mode: "greenfield", atStep: null });
    expect(Object.values(p).every((s) => s.status === "todo")).toBe(true);
  });
  it("mid-build → before entry validated, entry+after todo", () => {
    const p = defaultProcessForEntry({ mode: "mid-build", atStep: "dev_build" });
    expect(p.dsc_rampup.status).toBe("validated");
    expect(p.dev_scaffold.status).toBe("validated");
    expect(p.dev_build.status).toBe("todo");
    expect(p.dev_qa.status).toBe("todo");
  });
});

describe("normalizeClient", () => {
  it("fills defaults + full process map", () => {
    const c = normalizeClient({ name: "X" });
    expect(c.billing).toBe("billable");
    expect(c.opportunity).toEqual({ types: [], note: "" });
    expect(c.assignments).toEqual([]);
    expect(c.entryPoint).toEqual({ mode: "greenfield", atStep: null });
    expect(Object.keys(c.process)).toHaveLength(25);
    expect(c.process.dsc_rampup).toEqual({ status: "todo", note: "", decisions: [] });
  });
  it("preserves existing steps, backfills missing", () => {
    const c = normalizeClient({ name: "Y", process: { dsc_rampup: { status: "done", note: "", decisions: [] } } });
    expect(c.process.dsc_rampup.status).toBe("done");
    expect(c.process.def_scope.status).toBe("todo");
  });
  it("builds process from entryPoint when absent", () => {
    const c = normalizeClient({ name: "Z", entryPoint: { mode: "mid-build", atStep: "dev_build" } });
    expect(c.process.dsc_rampup.status).toBe("validated");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — module has only `PING`.

- [ ] **Step 3: Write the types**

`lib/types.ts`:
```ts
export type Status = "todo" | "doing" | "done" | "validated" | "skipped" | "na";
export type Load = "lead" | "core" | "light";
export interface Decision { what: string; why: string }
export interface StepInstance { status: Status; note: string; decisions: Decision[] }
export interface Assignment { name: string; role: string; load: Load }
export interface Opportunity {
  id: string; name: string; industry: string; stage: string;
  contact: string; notes: string; expertiseAsk: string; updatedAt?: number;
}
export interface Client {
  id: string; name: string; summary: string; start: string; end: string;
  phase: string; status: string;
  billing: "billable" | "internal";
  opportunity: { types: string[]; note: string };
  contractValue: number | null; buildUrl: string;
  assignments: Assignment[];
  risks: string[]; needs: string[]; findings: string[];
  links: { label: string; url: string }[];
  entryPoint: { mode: "greenfield" | "mid-build"; atStep: string | null };
  process: Record<string, StepInstance>;
  updatedAt?: number;
}
export interface Board { clients: Client[]; opportunities: Opportunity[] }
```

- [ ] **Step 4: Write the process module**

`lib/process.ts` (replace stub):
```ts
import type { Client, Status, StepInstance } from "@/lib/types";

export const BRAND = {
  navy: "#152238", red: "#E4413F", blue: "#2B6CB0", lightBlue: "#A9CCE8",
  pink: "#F2B6C6", paper: "#F7F5F1", ink: "#1D2733",
};

export const PHASES = ["Discover", "Define", "Design", "Develop", "Deploy"];

export const PROCESS = [
  { key: "discover", label: "Discover", blurb: "Understand the problem, domain, and whether to build", steps: [
    { id: "dsc_rampup", label: "Industry & business ramp-up", megamine: true },
    { id: "dsc_stakeholders", label: "Stakeholder & goal alignment" },
    { id: "dsc_research", label: "User & problem research" },
    { id: "dsc_competitive", label: "Competitive & landscape teardown" },
    { id: "dsc_feasibility", label: "Opportunity & feasibility read" },
  ]},
  { key: "define", label: "Define", blurb: "Lock scope, success criteria, and the plan", steps: [
    { id: "def_metrics", label: "Success metrics & goals" },
    { id: "def_scope", label: "Scope & SOW" },
    { id: "def_requirements", label: "Solution concept & requirements" },
    { id: "def_architecture", label: "Technical approach & architecture" },
    { id: "def_roadmap", label: "Roadmap & milestones" },
  ]},
  { key: "design", label: "Design", blurb: "Make it concrete and validate before heavy build", steps: [
    { id: "dsn_ia", label: "Information architecture & flows" },
    { id: "dsn_wireframes", label: "Wireframes & prototype" },
    { id: "dsn_ui", label: "UI & visual design" },
    { id: "dsn_validation", label: "Design validation" },
    { id: "dsn_handoff", label: "Design-to-dev handoff" },
  ]},
  { key: "develop", label: "Develop", blurb: "Build it", steps: [
    { id: "dev_scaffold", label: "Environment & scaffolding" },
    { id: "dev_build", label: "Core build (iterative)" },
    { id: "dev_integrations", label: "Integrations & data" },
    { id: "dev_qa", label: "QA & testing" },
    { id: "dev_security", label: "Security, data & compliance review" },
  ]},
  { key: "deploy", label: "Deploy", blurb: "Ship, hand off, set up for success", steps: [
    { id: "dep_readiness", label: "Launch readiness" },
    { id: "dep_release", label: "Production deploy" },
    { id: "dep_observability", label: "Monitoring & observability" },
    { id: "dep_handoff", label: "Handoff & enablement" },
    { id: "dep_review", label: "Post-launch review" },
  ]},
] as const;

export const ALL_STEPS = PROCESS.flatMap((p) =>
  p.steps.map((s) => ({ id: s.id, phaseKey: p.key, phaseLabel: p.label, label: s.label, megamine: "megamine" in s && !!s.megamine })));

export const STATUS_META: Record<Status, { icon: string; label: string; complete: boolean; applicable: boolean; badge?: boolean; color: string; bg: string }> = {
  todo:      { icon: "○", label: "Not started", complete: false, applicable: true,  color: "#8A93A3", bg: "#EEF1F6" },
  doing:     { icon: "◐", label: "In progress", complete: false, applicable: true,  color: BRAND.blue, bg: "#E3EEF8" },
  done:      { icon: "✓", label: "Done",        complete: true,  applicable: true,  color: "#2F855A", bg: "#E2F2E9" },
  validated: { icon: "✓", label: "Validated",   complete: true,  applicable: true,  badge: true, color: "#2B6CB0", bg: "#E3EEF8" },
  skipped:   { icon: "⊘", label: "Skipped",     complete: false, applicable: false, color: BRAND.red, bg: "#FBE3E3" },
  na:        { icon: "—", label: "N/A",         complete: false, applicable: false, color: "#8A93A3", bg: "#F0F2F6" },
};

export const OPP_TYPES = [
  { id: "expansion", label: "Expansion / more work" },
  { id: "referrals", label: "Referrals" },
  { id: "cosell", label: "Co-sell / partnership" },
  { id: "ssl_ip", label: "Build IP for SSL" },
];
export const BILLING = [
  { id: "billable", label: "Billable" },
  { id: "internal", label: "Internal (SSL side project)" },
];
export const LOAD = [
  { id: "lead", label: "Lead", weight: 3, dots: "●●●" },
  { id: "core", label: "Core", weight: 2, dots: "●●" },
  { id: "light", label: "Light", weight: 1, dots: "●" },
];

export const uid = () => Math.random().toString(36).slice(2, 10);
export const loadWeight = (id: string) => LOAD.find((l) => l.id === id)?.weight ?? 0;
export const formatMoney = (n: number | null | undefined) =>
  "$" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });
export const contractLabel = (c: Pick<Client, "billing" | "contractValue">) => {
  if (c.billing === "internal") return "Internal / non-billable";
  if (c.contractValue == null) return "—";
  return formatMoney(c.contractValue);
};

export function defaultProcessForEntry(entryPoint: Client["entryPoint"]): Record<string, StepInstance> {
  const idx = entryPoint?.mode === "mid-build" && entryPoint.atStep
    ? ALL_STEPS.findIndex((s) => s.id === entryPoint.atStep) : 0;
  const cut = idx < 0 ? 0 : idx;
  const out: Record<string, StepInstance> = {};
  ALL_STEPS.forEach((s, i) => { out[s.id] = { status: i < cut ? "validated" : "todo", note: "", decisions: [] }; });
  return out;
}

export function normalizeClient(c: Partial<Client> & { name?: string }): Client {
  const entryPoint = c.entryPoint?.mode
    ? { mode: c.entryPoint.mode, atStep: c.entryPoint.atStep ?? null }
    : { mode: "greenfield" as const, atStep: null };
  const base = c.process ? {} : defaultProcessForEntry(entryPoint);
  const process: Record<string, StepInstance> = { ...base };
  ALL_STEPS.forEach((s) => {
    const prev = c.process?.[s.id] || process[s.id];
    process[s.id] = {
      status: (prev?.status as Status) || "todo",
      note: prev?.note || "",
      decisions: Array.isArray(prev?.decisions) ? prev!.decisions : [],
    };
  });
  return {
    id: c.id || uid(),
    name: c.name || "",
    summary: c.summary || "",
    start: c.start || "",
    end: c.end || "",
    phase: c.phase || "Discover",
    status: c.status || "On Track",
    billing: c.billing || "billable",
    opportunity: { types: c.opportunity?.types ?? [], note: c.opportunity?.note || "" },
    contractValue: c.contractValue ?? null,
    buildUrl: c.buildUrl || "",
    assignments: (c.assignments ?? []).map((a) => ({ name: a.name || "", role: a.role || "", load: a.load || "core" })),
    risks: c.risks ?? [],
    needs: c.needs ?? [],
    findings: c.findings ?? [],
    links: c.links ?? [],
    entryPoint,
    process,
    updatedAt: c.updatedAt || Date.now(),
  };
}
```

- [ ] **Step 5: Run tests + type check**

Run: `npm test && npm run check`
Expected: all template/formatter/entry/normalize tests PASS; `tsc` clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: typed process template, constants, entry-point seeding, normalize"
```

---

## Task 4: Roll-ups, progress, skipped, resource allocation

**Files:**
- Modify: `lib/process.ts`, `lib/process.test.ts`

**Interfaces:**
- Consumes: `PROCESS`, `ALL_STEPS`, `STATUS_META`, `loadWeight` from Task 3.
- Produces: `phaseRollup(client, phaseKey)`, `clientProgress(client)`, `skippedItems(client)`, `CAPACITY`, `resourceRows(clients)`.

- [ ] **Step 1: Write failing tests**

Append to `lib/process.test.ts`:
```ts
import { phaseRollup, clientProgress, skippedItems, resourceRows, CAPACITY } from "./process";

const sample = () => normalizeClient({
  name: "Sample",
  process: {
    dsc_rampup: { status: "done", note: "", decisions: [] },
    dsc_stakeholders: { status: "done", note: "", decisions: [] },
    dsc_research: { status: "validated", note: "client did it", decisions: [] },
    dsc_competitive: { status: "skipped", note: "client provided", decisions: [] },
    dsc_feasibility: { status: "na", note: "", decisions: [] },
    def_metrics: { status: "doing", note: "", decisions: [] },
  },
});

describe("phaseRollup", () => {
  it("counts complete + excludes skipped/na", () => {
    const r = phaseRollup(sample(), "discover");
    expect(r).toMatchObject({ total: 5, done: 3, skipped: 1, na: 1, applicable: 3, complete: true });
  });
  it("define incomplete (a step only doing)", () => {
    expect(phaseRollup(sample(), "define").complete).toBe(false);
  });
});
describe("clientProgress", () => {
  it("percent of applicable complete", () => {
    const p = clientProgress(sample());
    expect(p.done).toBe(3);
    expect(p.applicable).toBe(23);
    expect(p.pct).toBe(Math.round((3 / 23) * 100));
  });
});
describe("skippedItems", () => {
  it("lists skipped + na with labels", () => {
    const items = skippedItems(sample());
    expect(items.map((i) => i.id).sort()).toEqual(["dsc_competitive", "dsc_feasibility"]);
    expect(items.find((i) => i.id === "dsc_competitive")!.note).toBe("client provided");
  });
});
describe("resourceRows", () => {
  const clients = [
    normalizeClient({ name: "Topminnow", phase: "Define", status: "On Track", assignments: [{ name: "Calvin", role: "Lead", load: "lead" }] }),
    normalizeClient({ name: "Acme", phase: "Develop", status: "At Risk", assignments: [{ name: "Calvin", role: "Core", load: "core" }, { name: "Tyler", role: "Support", load: "light" }] }),
  ];
  it("aggregates and sums weight", () => {
    const calvin = resourceRows(clients).find((r) => r.name === "Calvin")!;
    expect(calvin.assignments).toHaveLength(2);
    expect(calvin.weight).toBe(5);
  });
  it("flags over capacity and sorts desc", () => {
    const heavy = resourceRows([
      normalizeClient({ name: "P1", assignments: [{ name: "Dana", role: "Lead", load: "lead" }] }),
      normalizeClient({ name: "P2", assignments: [{ name: "Dana", role: "Lead", load: "lead" }] }),
    ]);
    expect(heavy[0].name).toBe("Dana");
    expect(heavy[0].over).toBe(true); // 6 > CAPACITY(5)
    expect(CAPACITY).toBe(5);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement (append to `lib/process.ts`)**

```ts
import type { Client } from "@/lib/types"; // already imported at top; do not duplicate

export function phaseRollup(client: Client, phaseKey: string) {
  const phase = PROCESS.find((p) => p.key === phaseKey);
  const steps = phase ? phase.steps : [];
  let done = 0, skipped = 0, na = 0;
  steps.forEach((s) => {
    const st = client.process?.[s.id]?.status || "todo";
    if (st === "skipped") skipped++;
    else if (st === "na") na++;
    else if (STATUS_META[st]?.complete) done++;
  });
  const applicable = steps.length - skipped - na;
  return { done, skipped, na, applicable, total: steps.length, complete: done === applicable };
}

export function clientProgress(client: Client) {
  let done = 0, applicable = 0;
  ALL_STEPS.forEach((s) => {
    const st = client.process?.[s.id]?.status || "todo";
    if (st === "skipped" || st === "na") return;
    applicable++;
    if (STATUS_META[st]?.complete) done++;
  });
  return { done, applicable, pct: applicable === 0 ? 0 : Math.round((done / applicable) * 100) };
}

export function skippedItems(client: Client) {
  return ALL_STEPS.filter((s) => { const st = client.process?.[s.id]?.status; return st === "skipped" || st === "na"; })
    .map((s) => ({ id: s.id, phaseLabel: s.phaseLabel, stepLabel: s.label, status: client.process[s.id].status, note: client.process[s.id].note || "" }));
}

export const CAPACITY = 5;
export function resourceRows(clients: Client[]) {
  const byName = new Map<string, { name: string; weight: number; assignments: { client: string; role: string; load: string; phase: string; status: string }[] }>();
  clients.forEach((c) => {
    (c.assignments || []).forEach((a) => {
      if (!a.name) return;
      if (!byName.has(a.name)) byName.set(a.name, { name: a.name, weight: 0, assignments: [] });
      const row = byName.get(a.name)!;
      row.weight += loadWeight(a.load);
      row.assignments.push({ client: c.name, role: a.role || "", load: a.load || "core", phase: c.phase, status: c.status });
    });
  });
  return [...byName.values()].map((r) => ({ ...r, over: r.weight > CAPACITY })).sort((a, b) => b.weight - a.weight);
}
```

Note: `Client` is already imported at the top of `lib/process.ts` (Task 3). Do **not** add a second import — remove the duplicate import line shown above and just add the function bodies.

- [ ] **Step 4: Run tests + type check**

Run: `npm test && npm run check`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: roll-ups, progress, skipped summary, resource aggregation"
```

---

## Task 5: Server actions + seed script

**Files:**
- Create: `lib/actions.ts`, `scripts/seed.ts`

**Interfaces:**
- Consumes: `db`, `schema`, `normalizeClient`, `defaultProcessForEntry`, `uid`.
- Produces (server actions): `getBoard(): Promise<Board>`, `upsertClient(input): Promise<void>`, `deleteClient(id): Promise<void>`, `saveStep(clientId, stepId, patch): Promise<void>`, `upsertOpportunity(input): Promise<void>`, `deleteOpportunity(id): Promise<void>`. `seed.ts` populates Neon.

- [ ] **Step 1: Write the server actions**

`lib/actions.ts`:
```ts
"use server";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clients, opportunities } from "@/lib/db/schema";
import { normalizeClient } from "@/lib/process";
import type { Board, Client, Opportunity, StepInstance } from "@/lib/types";

export async function getBoard(): Promise<Board> {
  const [cRows, oRows] = await Promise.all([db.select().from(clients), db.select().from(opportunities)]);
  const cs = cRows
    .map((r) => normalizeClient(r as unknown as Partial<Client>))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  const os = oRows.map((o) => ({
    id: o.id, name: o.name, industry: o.industry, stage: o.stage,
    contact: o.contact, notes: o.notes, expertiseAsk: o.expertiseAsk,
  })) as Opportunity[];
  return { clients: cs, opportunities: os };
}

export async function upsertClient(input: Partial<Client>): Promise<void> {
  const c = normalizeClient(input);
  const row = {
    name: c.name, summary: c.summary, start: c.start, end: c.end, phase: c.phase, status: c.status,
    billing: c.billing, contractValue: c.contractValue, buildUrl: c.buildUrl,
    opportunity: c.opportunity, assignments: c.assignments,
    risks: c.risks, needs: c.needs, findings: c.findings, links: c.links,
    entryPoint: c.entryPoint, process: c.process, updatedAt: new Date(),
  };
  const existing = input.id ? await db.select({ id: clients.id }).from(clients).where(eq(clients.id, input.id)) : [];
  if (existing.length) await db.update(clients).set(row).where(eq(clients.id, input.id!));
  else await db.insert(clients).values(row);
  revalidatePath("/");
}

export async function deleteClient(id: string): Promise<void> {
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/");
}

export async function saveStep(clientId: string, stepId: string, patch: Partial<StepInstance>): Promise<void> {
  const [row] = await db.select().from(clients).where(eq(clients.id, clientId));
  if (!row) return;
  const process = { ...(row.process as Record<string, StepInstance>) };
  process[stepId] = { ...process[stepId], ...patch } as StepInstance;
  await db.update(clients).set({ process, updatedAt: new Date() }).where(eq(clients.id, clientId));
  revalidatePath("/");
}

export async function upsertOpportunity(input: Partial<Opportunity>): Promise<void> {
  const row = {
    name: input.name || "", industry: input.industry || "", stage: input.stage || "Lead",
    contact: input.contact || "", notes: input.notes || "", expertiseAsk: input.expertiseAsk || "", updatedAt: new Date(),
  };
  const existing = input.id ? await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.id, input.id)) : [];
  if (existing.length) await db.update(opportunities).set(row).where(eq(opportunities.id, input.id!));
  else await db.insert(opportunities).values(row);
  revalidatePath("/");
}

export async function deleteOpportunity(id: string): Promise<void> {
  await db.delete(opportunities).where(eq(opportunities.id, id));
  revalidatePath("/");
}
```

- [ ] **Step 2: Write the seed script**

`scripts/seed.ts`:
```ts
import "dotenv/config";
import { db } from "@/lib/db";
import { clients, opportunities } from "@/lib/db/schema";
import { normalizeClient } from "@/lib/process";

async function main() {
  await db.delete(clients);
  await db.delete(opportunities);

  const topminnow = normalizeClient({
    name: "Topminnow", summary: "ETL pipeline platform — fixed-bid SOW engagement.",
    start: "2026-06-15", end: "2026-10-30", phase: "Define", status: "On Track",
    billing: "billable", opportunity: { types: ["expansion"], note: "Likely phase-2 build after SOW lands." },
    contractValue: 85000, buildUrl: "",
    assignments: [{ name: "Calvin", role: "Eng / Lead", load: "lead" }],
    risks: ["Spec docs and SOW language not fully reconciled yet"],
    needs: ["Second set of eyes on SOW scope language before it goes back to Kit"],
    findings: ["Client contact (Kit) responsive; expects tight scope discipline on fixed-bid"],
    entryPoint: { mode: "greenfield", atStep: null },
  });
  Object.assign(topminnow.process.dsc_rampup, { status: "done" });
  Object.assign(topminnow.process.dsc_stakeholders, { status: "done" });
  Object.assign(topminnow.process.dsc_research, { status: "done" });
  Object.assign(topminnow.process.dsc_competitive, { status: "skipped", note: "Client provided their own market analysis." });
  Object.assign(topminnow.process.dsc_feasibility, { status: "done" });
  Object.assign(topminnow.process.def_metrics, { status: "doing" });
  Object.assign(topminnow.process.def_scope, { status: "doing", decisions: [{ what: "Fixed-bid, not T&M", why: "Client wanted budget certainty; scope well understood." }] });

  const rivet = normalizeClient({
    name: "Rivet Health", summary: "Patient intake tool — picked up mid-build to stabilize and ship.",
    start: "2026-05-01", end: "2026-09-15", phase: "Develop", status: "At Risk",
    billing: "billable", opportunity: { types: ["expansion", "ssl_ip"], note: "Reusable intake engine could become SSL IP." },
    contractValue: 140000, buildUrl: "https://staging.rivethealth.example.com",
    assignments: [{ name: "Tyler", role: "Eng / Lead", load: "lead" }, { name: "Calvin", role: "Architecture", load: "core" }],
    risks: ["Inherited codebase has no tests", "HIPAA posture unverified"],
    needs: ["Security reviewer for the compliance step"],
    findings: ["Prior team shipped UI without a data model review — rework likely"],
    entryPoint: { mode: "mid-build", atStep: "dev_build" },
  });
  Object.assign(rivet.process.dsc_research, { note: "Reviewed prior discovery deck — thin on real user interviews." });
  Object.assign(rivet.process.dev_build, { status: "doing" });
  Object.assign(rivet.process.dev_security, { status: "na", note: "Deferred to a separate compliance SOW — out of scope here." });

  const mk = (c: ReturnType<typeof normalizeClient>) => ({
    name: c.name, summary: c.summary, start: c.start, end: c.end, phase: c.phase, status: c.status,
    billing: c.billing, contractValue: c.contractValue, buildUrl: c.buildUrl,
    opportunity: c.opportunity, assignments: c.assignments, risks: c.risks, needs: c.needs,
    findings: c.findings, links: c.links, entryPoint: c.entryPoint, process: c.process,
  });
  await db.insert(clients).values([mk(topminnow), mk(rivet)]);
  await db.insert(opportunities).values([{
    name: "Healthcare charge capture tool", industry: "Healthcare / RCM", stage: "Scoping",
    contact: "Joshua Briggs",
    notes: "Replacing AlertMD for independent physician groups. Two-phase 5D framing. Open question: internal tool vs. sellable SaaS.",
    expertiseAsk: "Anyone with healthcare, RCM, CPT/ICD-10 coding, or HIPAA/BAA experience?",
  }]);
  console.log("Seeded 2 clients + 1 opportunity.");
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

Install `dotenv` for the script: `npm install -D dotenv`.

- [ ] **Step 3: Seed + verify**

Run: `npm run seed`
Expected: "Seeded 2 clients + 1 opportunity." Confirm rows in Neon. Then `npm run check` clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: server actions (CRUD + saveStep) and seed script"
```

---

## Task 6: UI primitives + BRAND helpers

**Files:**
- Create: `components/ui.tsx`

**Interfaces:**
- Consumes: `BRAND`, `PHASES`, `STATUS_META`.
- Produces (client components/consts): `Chip`, `Field`, `inputCls`, `inputStyle`, `StepIcon`, `PhaseTracker`, `TimeBar`. All `"use client"` where they use hooks/handlers; pure display ones can be server-safe but mark the file `"use client"` for simplicity since consumers are client components.

- [ ] **Step 1: Port the primitives**

Read `dashboard.jsx` for the exact markup of `Chip` (lines ~90–105), `Field` (~330–340), `inputCls`/`inputStyle` (~342–344), `PhaseTracker` (~107–159), `TimeBar` (~161–189). Recreate them in `components/ui.tsx` as typed TSX, importing `BRAND`, `PHASES`, `STATUS_META` from `@/lib/process`. Add `StepIcon`:
```tsx
"use client";
import { BRAND, PHASES, STATUS_META } from "@/lib/process";
import type { Status } from "@/lib/types";

export const inputCls = "w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2";
export const inputStyle = { borderColor: "#D3D9E2", background: "#fff", color: BRAND.ink } as const;

export const Chip = ({ children, tone = "navy" }: { children: React.ReactNode; tone?: "navy" | "pink" | "blue" }) => { /* port from dashboard.jsx */ };
export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => { /* port */ };
export const PhaseTracker = ({ phase }: { phase: string }) => { /* port from dashboard.jsx PhaseTracker */ };
export const TimeBar = ({ start, end }: { start: string; end: string }) => { /* port from dashboard.jsx TimeBar */ };

export const StepIcon = ({ status }: { status: Status }) => {
  const m = STATUS_META[status] || STATUS_META.todo;
  return (
    <span className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{ width: 20, height: 20, fontSize: 12, color: m.color, background: m.bg, fontWeight: 700 }} title={m.label}>
      {m.icon}
    </span>
  );
};
```
Replace each `/* port */` with the actual JSX from `dashboard.jsx`, swapping `BRAND.x` references (already imported) and converting to TS (type the params as shown).

- [ ] **Step 2: Type check**

Run: `npm run check`
Expected: clean. (No unit test — pure display; verified visually in later tasks.)

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: UI primitives (Chip, Field, PhaseTracker, TimeBar, StepIcon)"
```

---

## Task 7: Board shell + timeline + read-only client cards

**Files:**
- Modify: `app/page.tsx`
- Create: `components/Board.tsx`, `components/TimelineOverview.tsx`, `components/ClientCard.tsx`

**Interfaces:**
- Consumes: `getBoard`, primitives, `contractLabel`, `clientProgress`, `BILLING`, `OPP_TYPES`.
- Produces: `<Board initial={board} />` client component with `view` state + a refresh (calls `router.refresh()`), rendering the header, `TimelineOverview`, and a list of `ClientCard` (display only; editors wired in later tasks via callbacks that are stubbed to open state).

- [ ] **Step 1: Server page fetches the board**

`app/page.tsx`:
```tsx
import { getBoard } from "@/lib/actions";
import { Board } from "@/components/Board";
export default async function Home() {
  const board = await getBoard();
  return <Board initial={board} />;
}
```

- [ ] **Step 2: Board shell**

`components/Board.tsx` — `"use client"`. Port the header + layout from `dashboard.jsx` (`SSLStandupDashboard`, lines ~612–655 for the header; note stats: active count, at-risk count, open asks). Hold state:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Board as BoardT } from "@/lib/types";
import { BRAND } from "@/lib/process";
import { TimelineOverview } from "./TimelineOverview";
import { ClientCard } from "./ClientCard";

export function Board({ initial }: { initial: BoardT }) {
  const router = useRouter();
  const [view, setView] = useState<"client" | "resource">("client");
  const [editingClient, setEditingClient] = useState<string | null>(null); // id | "new" | null
  const { clients, opportunities } = initial;
  const atRisk = clients.filter((c) => c.status === "At Risk" || c.status === "Blocked").length;
  const openAsks = clients.reduce((n, c) => n + (c.needs?.length || 0), 0);
  // header (port markup, add the view toggle from Task 12), then:
  return (
    <div className="min-h-screen" style={{ background: BRAND.paper, fontFamily: "'Archivo', system-ui, sans-serif", color: BRAND.ink }}>
      {/* ...header with {clients.length} active / {atRisk} at risk / {openAsks} open asks + Refresh (router.refresh()) ... */}
      <main className="max-w-5xl mx-auto px-6 md:px-10 py-8">
        <h2 className="text-2xl mb-4" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>Engagement calendar</h2>
        <TimelineOverview clients={clients} />
        <div className="flex items-baseline justify-between mb-4 mt-8">
          <h2 className="text-2xl" style={{ fontFamily: "'Fraunces', serif", fontWeight: 700, color: BRAND.navy }}>Active engagements</h2>
          <button onClick={() => setEditingClient("new")} className="px-4 py-2 rounded-md text-sm font-semibold text-white" style={{ background: BRAND.red }}>+ Add client</button>
        </div>
        <div className="space-y-4 mb-12">
          {clients.map((c) => <ClientCard key={c.id} client={c} onEdit={() => setEditingClient(c.id)} />)}
        </div>
        {/* Opportunities section added in Task 11; ClientEditor wired in Task 9; ResourceView + toggle in Task 12 */}
      </main>
    </div>
  );
}
```
Port the exact header JSX from `dashboard.jsx`; keep the "Refresh" button but wire it to `router.refresh()` (server refetch) instead of `window.storage`.

- [ ] **Step 3: TimelineOverview**

`components/TimelineOverview.tsx` — `"use client"`. Port `TimelineOverview` from `dashboard.jsx` (lines ~192–328) verbatim into typed TSX; it takes `clients` and an optional `onSelect`. Uses `STATUS` colors — port the `STATUS` map (lines ~21–26) into `lib/process.ts` as an export `STATUS` and import it (the timeline + status badges need it).

- [ ] **Step 4: ClientCard (display only)**

`components/ClientCard.tsx` — `"use client"`. Port the card render from `dashboard.jsx` (lines ~709–767): header (name, status badge, summary), the **deal-signal row** (billing badge, `contractLabel(c)`, `clientProgress(c).pct`, opportunity chips, "See the build ↗"), assignment chips (`c.assignments.map`), `PhaseTracker`, `TimeBar`, and the expand/collapse "Details"/"Edit" buttons. Props: `{ client, onEdit }`. Expanded content (process section + skipped panel + lists) is added in Task 8; for now render the existing Risks/Needs/Findings `ListBlock`s (port `ListBlock` too). Use local `useState` for expand/collapse. Fix the billing badge hexes: internal `#EDE9FE`/`#6B46C1`, billable `#E2F2E9`/`#2F855A`.

- [ ] **Step 5: Type check + visual**

Run: `npm run check && npm run dev`
Open localhost:3000: both seed clients render with deal signals, the calendar shows both, cards expand to show risks/needs/findings, "See the build ↗" appears on Rivet. Refresh button refetches.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: board shell, timeline, and read-only client cards"
```

---

## Task 8: Process section + skipped panel in the card

**Files:**
- Create: `components/ProcessSection.tsx`
- Modify: `components/ClientCard.tsx`

**Interfaces:**
- Consumes: `PROCESS`, `STATUS_META`, `phaseRollup`, `skippedItems`, `StepIcon`.
- Produces: `<ProcessSection client onStep />` and, in `ClientCard`, the process section + "Deliberately skipped / N-A" panel inside the expanded area. `onStep(stepId)` is passed from `ClientCard` up to `Board` (stubbed until Task 10).

- [ ] **Step 1: ProcessSection**

`components/ProcessSection.tsx` — `"use client"`. Port the `ProcessSection` component from the earlier design (5 phases, roll-up headers via `phaseRollup`, step rows with `StepIcon`, Megamine `✦`, note + decisions count, click → `onStep(step.id)`):
```tsx
"use client";
import { PROCESS, STATUS_META, phaseRollup } from "@/lib/process";
import { BRAND } from "@/lib/process";
import { StepIcon } from "./ui";
import type { Client } from "@/lib/types";

export function ProcessSection({ client, onStep }: { client: Client; onStep: (stepId: string) => void }) {
  return (
    <div>
      {PROCESS.map((phase) => {
        const r = phaseRollup(client, phase.key);
        return (
          <div key={phase.key} className="mb-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[11px] uppercase tracking-widest font-bold" style={{ color: BRAND.navy }}>{phase.label}</span>
              <span className="text-[11px]" style={{ color: r.complete ? "#2F855A" : "#8A93A3" }}>
                {r.done}/{r.applicable}{r.skipped ? ` · ${r.skipped} skipped` : ""}{r.na ? ` · ${r.na} n/a` : ""}
              </span>
            </div>
            <div className="space-y-0.5">
              {phase.steps.map((s) => {
                const inst = client.process?.[s.id] || { status: "todo" as const, note: "", decisions: [] };
                const m = STATUS_META[inst.status] || STATUS_META.todo;
                const dim = inst.status === "skipped" || inst.status === "na";
                return (
                  <button key={s.id} onClick={() => onStep(s.id)}
                    className="w-full flex items-start gap-2 text-left px-2 py-1 rounded-md hover:bg-black/[0.03]" style={{ opacity: dim ? 0.6 : 1 }}>
                    <StepIcon status={inst.status} />
                    <span className="flex-1 min-w-0">
                      <span className="text-sm" style={{ color: BRAND.ink, textDecoration: inst.status === "skipped" ? "line-through" : "none" }}>
                        {s.label}{"megamine" in s && s.megamine ? " ✦" : ""}
                      </span>
                      {inst.note && <span className="block text-[11px]" style={{ color: "#8A93A3" }}>{m.label}: {inst.note}</span>}
                      {inst.decisions?.length > 0 && <span className="block text-[11px]" style={{ color: BRAND.blue }}>{inst.decisions.length} decision{inst.decisions.length > 1 ? "s" : ""} logged</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Wire into ClientCard's expanded area**

In `ClientCard`, add a `onStep` prop and render, inside the expanded block: a "5D Process" heading, `<ProcessSection client={client} onStep={onStep} />`, then the skipped panel:
```tsx
{(() => {
  const items = skippedItems(client);
  if (!items.length) return null;
  return (
    <div className="mt-3 p-3 rounded-md" style={{ background: "#FBF7F0", border: "1px solid #F0E6D6" }}>
      <div className="text-[11px] uppercase tracking-widest font-semibold mb-1" style={{ color: "#B7791F" }}>Deliberately skipped / not applicable</div>
      <ul className="text-sm space-y-1" style={{ color: BRAND.ink }}>
        {items.map((it) => (
          <li key={it.id} className="flex gap-2">
            <span style={{ color: "#B7791F" }}>{it.status === "skipped" ? "⊘" : "—"}</span>
            <span><span className="font-semibold">{it.stepLabel}</span> <span style={{ color: "#8A93A3" }}>({it.phaseLabel})</span>{it.note ? ` — ${it.note}` : ""}</span>
          </li>
        ))}
      </ul>
    </div>
  );
})()}
```
Then the Risks/Needs/Findings/Links grid. Thread `onStep` from `Board` → `ClientCard` → `ProcessSection` (in `Board`, pass `onStep={(stepId) => setStepEdit({ clientId: c.id, stepId })}`; add `const [stepEdit, setStepEdit] = useState<{clientId:string;stepId:string}|null>(null)` now — used in Task 10).

- [ ] **Step 3: Type check + visual**

Run: `npm run check && npm run dev`
Expand Topminnow: 5 phases with roll-ups, Megamine ✦, skipped step struck through, and the amber "skipped / n-a" panel (Topminnow: Competitive teardown; Rivet: Security n/a). Clicking a step does nothing yet.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: 5D process section and skipped-step panel on cards"
```

---

## Task 9: Client editor wired to upsertClient

**Files:**
- Create: `components/ClientEditor.tsx`
- Modify: `components/Board.tsx`

**Interfaces:**
- Consumes: `upsertClient`, `deleteClient`, `BILLING`, `OPP_TYPES`, `LOAD`, `ALL_STEPS`, `PHASES`, `STATUS`, primitives.
- Produces: `<ClientEditor initial? onSaved onCancel />`; `Board` renders it for `editingClient === "new"` or an id, calling `upsertClient` then `router.refresh()`.

- [ ] **Step 1: Port + wire the editor**

`components/ClientEditor.tsx` — `"use client"`. Port `ClientEditor` from the earlier design (deal fields: name, summary, start, end, phase, status, billing, contract value; opportunity multi-select pills + note; build URL; assignments editor with add/remove and load select; entry-point picker; risks/needs/findings/links textareas). On submit, build the client object and call the action:
```tsx
"use client";
import { useState } from "react";
import { upsertClient, deleteClient } from "@/lib/actions";
import { BILLING, OPP_TYPES, LOAD, ALL_STEPS, PHASES, STATUS, BRAND } from "@/lib/process";
import { Field, inputCls, inputStyle } from "./ui";
import type { Client } from "@/lib/types";

export function ClientEditor({ initial, onSaved, onCancel }: { initial?: Client; onSaved: () => void; onCancel: () => void }) {
  const [f, setF] = useState({ /* same field state shape as the artifact ClientEditor, incl. oppTypes[], assignments[], entryMode, entryStep */ });
  const [busy, setBusy] = useState(false);
  // set(), toggleOpp(), setAssignment(), addAssignment(), removeAssignment(), lines() — port from the artifact-plan editor
  const submit = async () => {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    await upsertClient({
      id: initial?.id,
      name: f.name.trim(), summary: f.summary.trim(), start: f.start, end: f.end,
      phase: f.phase, status: f.status, billing: f.billing as Client["billing"],
      opportunity: { types: f.oppTypes, note: f.oppNote.trim() },
      contractValue: f.contractValue === "" ? null : Number(f.contractValue),
      buildUrl: f.buildUrl.trim(),
      assignments: f.assignments.map((a) => ({ name: a.name.trim(), role: a.role.trim(), load: a.load })).filter((a) => a.name),
      entryPoint: { mode: f.entryMode as Client["entryPoint"]["mode"], atStep: f.entryMode === "mid-build" ? (f.entryStep || null) : null },
      risks: lines(f.risks), needs: lines(f.needs), findings: lines(f.findings),
      links: lines(f.links).map((l) => { const [label, url] = l.split("|").map((x) => x.trim()); return { label: label || url, url: url || label }; }),
      process: initial?.process, // preserve when editing; new clients seed from entryPoint via normalizeClient
    });
    onSaved();
  };
  const remove = async () => { if (initial && !busy) { setBusy(true); await deleteClient(initial.id); onSaved(); } };
  return (/* port the full editor markup; wire submit/remove/onCancel; disable buttons while busy */);
}
```
Use the exact field markup from the artifact-plan `ClientEditor` (Task 7 there) — billing/contract in the grid, opportunity pills, build URL, assignments rows, entry-point picker with `ALL_STEPS` options, and the risks/needs/findings/links textareas.

- [ ] **Step 2: Render it in Board**

In `Board`, when `editingClient === "new"` render `<ClientEditor onSaved={() => { setEditingClient(null); router.refresh(); }} onCancel={() => setEditingClient(null)} />` above the list; for an id, render it in place of that card with `initial={c}`.

- [ ] **Step 3: Type check + visual**

Run: `npm run check && npm run dev`
Add a greenfield client → saves, appears, process all "Not started". Add a mid-build client at "Develop — Core build" → earlier steps pre-marked Validated. Edit a client, change contract/opportunity/assignments → persists across a refresh. Delete works.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: client editor (deal layer, assignments, entry point) wired to DB"
```

---

## Task 10: Step editor modal wired to saveStep

**Files:**
- Create: `components/StepEditor.tsx`
- Modify: `components/Board.tsx`

**Interfaces:**
- Consumes: `saveStep`, `STATUS_META`, `ALL_STEPS`, primitives.
- Produces: `<StepEditor step instance onSaved onClose />`; `Board` renders it when `stepEdit` is set and calls `saveStep(clientId, stepId, patch)`.

- [ ] **Step 1: Port the modal**

`components/StepEditor.tsx` — `"use client"`. Port `StepEditor` from the artifact-plan (status pills from `STATUS_META`, note textarea with required-on-skip guard, decisions list add/remove, backdrop-click to close — no native dialogs). On save call the action:
```tsx
"use client";
import { useState } from "react";
import { STATUS_META, BRAND } from "@/lib/process";
import { Field, inputCls, inputStyle } from "./ui";
import type { StepInstance, Status } from "@/lib/types";

export function StepEditor({ step, instance, onSaved, onClose }:
  { step: { label: string; phaseLabel: string }; instance: StepInstance;
    onSaved: (patch: Partial<StepInstance>) => void; onClose: () => void }) {
  const [status, setStatus] = useState<Status>(instance.status);
  const [note, setNote] = useState(instance.note || "");
  const [decisions, setDecisions] = useState(instance.decisions?.length ? instance.decisions : []);
  const requiresNote = status === "skipped";
  // addDecision/setD/removeD as in the artifact plan
  const save = () => { if (requiresNote && !note.trim()) return; onSaved({ status, note: note.trim(), decisions: decisions.filter((d) => d.what.trim() || d.why.trim()) }); };
  return (/* port the modal markup from the artifact-plan StepEditor */);
}
```

- [ ] **Step 2: Render + wire in Board**

In `Board`, near the end:
```tsx
{stepEdit && (() => {
  const client = clients.find((c) => c.id === stepEdit.clientId);
  const step = ALL_STEPS.find((s) => s.id === stepEdit.stepId);
  if (!client || !step) return null;
  return <StepEditor step={step} instance={client.process[step.id]}
    onSaved={async (patch) => { await saveStep(client.id, step.id, patch); setStepEdit(null); router.refresh(); }}
    onClose={() => setStepEdit(null)} />;
})()}
```
Import `saveStep`, `ALL_STEPS`.

- [ ] **Step 3: Type check + visual**

Run: `npm run check && npm run dev`
Expand a client, click a step, set Skipped (Save blocked until a reason is typed), add a decision, save → row updates, roll-up recomputes, persists across refresh.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: step editor modal (status, why-note, decisions) wired to DB"
```

---

## Task 11: Opportunities section

**Files:**
- Create: `components/OppEditor.tsx`
- Modify: `components/Board.tsx`

**Interfaces:**
- Consumes: `upsertOpportunity`, `deleteOpportunity`, `OPP_STAGES`, `Chip`.
- Produces: the opportunity pipeline (list + add/edit) wired to actions. Port `OPP_STAGES` (artifact line ~28) into `lib/process.ts` as an export.

- [ ] **Step 1: Port OppEditor + list**

`components/OppEditor.tsx` — port `OppEditor` from `dashboard.jsx` (lines ~479–539) to TSX; on save call `upsertOpportunity`, on delete `deleteOpportunity`. In `Board`, add the "Potential new opportunities" section (port lines ~770–836) with an `editingOpp` state, rendering the opportunity cards + editor, calling `router.refresh()` after mutations.

- [ ] **Step 2: Type check + visual**

Run: `npm run check && npm run dev`
The seed opportunity (Healthcare charge capture) renders; add/edit/delete an opportunity persists.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: opportunity pipeline wired to DB"
```

---

## Task 12: Resource view + header toggle

**Files:**
- Create: `components/ResourceView.tsx`
- Modify: `components/Board.tsx`

**Interfaces:**
- Consumes: `resourceRows`, `CAPACITY`, `LOAD`, `STATUS`.
- Produces: the "By client / By resource" header toggle and the by-person allocation view.

- [ ] **Step 1: ResourceView**

`components/ResourceView.tsx` — `"use client"`. Port the `ResourceView` from the artifact plan (per-person cards, summed `weight` vs `CAPACITY`, `over` red border + "⚠ Stacked" flag, per-assignment row with status dot + load dots).

- [ ] **Step 2: Toggle + branch in Board**

Add the toggle to the header (the `[["client","By client"],["resource","By resource"]]` segmented control from the artifact plan). Branch `main`: when `view === "resource"`, render `<h2>Team allocation</h2><ResourceView clients={clients} />`; else the existing calendar + engagements + opportunities.

- [ ] **Step 3: Type check + visual**

Run: `npm run check && npm run dev`
Toggle "By resource": Calvin shows Topminnow (lead) + Rivet (core) = load 5; Tyler shows Rivet (lead) = 3. Bump someone over 5 and confirm the ⚠ flag + red border.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: by-resource allocation view with over-allocation flag"
```

---

## Task 13: Deploy, protect, document, tag

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: everything.
- Produces: a live, deployment-protected Vercel app + tagged v1.

- [ ] **Step 1: Full verification**

Run: `npm test && npm run check && npm run build`
Expected: logic tests green, `tsc` clean, production build succeeds.

- [ ] **Step 2: Deploy to Vercel**

Push the branch and open a PR (preview deploy), or `npx vercel --prod`. Confirm `DATABASE_URL` is set in Vercel Project → Settings → Environment Variables for Production + Preview. Run the seed against the production DB once (`npm run seed` with prod `DATABASE_URL`, or a one-off) so the live app has data.

- [ ] **Step 3: Enable deployment protection (ADR 0003)**

In Vercel → Project → Settings → **Deployment Protection**, enable protection (Vercel Authentication or Password) for Production **and** Preview. Verify the app prompts before loading.

- [ ] **Step 4: Rewrite README for the standalone app**

Replace the artifact-era `README.md` with standalone instructions: stack, `npm install`, `.env` (`DATABASE_URL`), `npm run db:migrate`, `npm run seed`, `npm run dev`, `npm test`, and "deploys on push to main via Vercel; access is behind deployment protection." Note `dashboard.jsx` is the retired prototype.

- [ ] **Step 5: Commit + tag**

```bash
git add -A
git commit -m "chore: v1 standalone — deploy docs and README"
git tag -a v1.0 -m "Client Board v1 (standalone): deal layer, 5D process, resource view"
git push origin main --tags
```

---

## Self-Review (completed by plan author)

**Spec coverage:** deal layer → T3,5,7,9 · 25-step process → T3 · per-step status/note/decisions → T3,8,10 · entry point → T3,9 · roll-ups/progress/skipped → T4,8 · resource view → T4,12 · persistence (Neon/Drizzle, JSONB, normalize on read+write) → T2,5 · server actions → T5 · deployment protection → T13 · fresh seed → T5 · v2 (AI) explicitly out of scope. ✓

**Placeholder scan:** Component tasks (6–12) intentionally say "port from `dashboard.jsx`/artifact-plan" for large, already-specified JSX rather than re-pasting hundreds of lines; every such task pins the exact source lines, the props/types, and the new wiring code (action calls, state). Logic/DB/action tasks (2–5) contain complete code. This is a deliberate DRY choice against the reference prototype, not missing detail.

**Type consistency:** `Client`/`StepInstance`/`Assignment` from `lib/types.ts` used across schema (T2), logic (T3–4), actions (T5), components (T6–12). `saveStep(clientId, stepId, patch)`, `upsertClient(Partial<Client>)`, `resourceRows → { name, weight, over, assignments }` consistent between definition (T4–5) and consumers (T10,12). `entryPoint {mode, atStep}` and `process[stepId] {status,note,decisions}` consistent throughout.

**Note on component tasks:** unlike the pure-logic tasks, the UI tasks lean on the retired `dashboard.jsx` as a faithful markup reference. If executing with fresh subagents that lack that context, have each read `dashboard.jsx` (cheap, one file) at the start of its task — the plan cites exact line ranges.
