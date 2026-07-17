# AI Assistant — Phase 1 (Magic Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global AI assistant to the client board: you chat / paste a transcript / paste a link, it infers the client, auto-applies board changes via whitelisted tools that wrap the existing server actions, and every change lands in an activity feed with one-click undo.

**Architecture:** A streaming `/api/assistant` route runs a tool-calling agent (Vercel AI SDK v6, model via AI Gateway). The agent's tools wrap the existing `lib/actions.ts` server actions; each mutating tool snapshots the affected row (before-image) and writes an `activity` row, so undo = restore the before-image (or delete a created row). A client `useChat` panel drives it; an activity feed renders the audit trail with undo buttons. Board revalidates after each turn.

**Tech Stack:** Next.js 15 App Router, Vercel AI SDK v6 (`ai`, `@ai-sdk/react`) via AI Gateway, Drizzle + Neon, Zod, Vitest. Spec: `docs/PRODUCT_SPEC.md` §7; decision: `docs/adr/0004-*`.

## Global Constraints

- **The agent's ONLY capabilities are the whitelisted tools** in `lib/assistant/tools.ts`, which wrap `lib/actions.ts`. No raw SQL/DB access from the agent. Destructive tools (`deleteClient`) require an explicit `confirmed: true` arg.
- **Every mutating tool records an `activity` row with a before-image** (the affected client/opportunity's full prior row, or `null` for a create). Undo restores it. This is load-bearing and must be tested (apply → undo → equals before).
- **Auto-apply model** (ADR 0004): tools apply immediately; trust comes from the reversible activity log, not pre-approval.
- **AI SDK v6 API is fast-moving.** For Tasks 5 & 6, CONFIRM the exact current signatures of `streamText`, `tool`, `stepCountIs`/`stopWhen`, `useChat`, and `toUIMessageStreamResponse` via the `vercel:ai-sdk` skill or Context7 (`/vercel/ai`) before finalizing — the code blocks here are idiomatic-v6 but treat the live docs as authoritative if they differ.
- **Model:** default `anthropic/claude-sonnet-5` through the AI Gateway (plain `provider/model` string — do NOT add `@ai-sdk/anthropic`). Confirm the exact gateway model id. Auth: AI Gateway uses the Vercel OIDC token automatically on Vercel and locally (`VERCEL_OIDC_TOKEN` is already in `.env` from `vercel env pull`).
- **Per-turn tool-call cap** to bound cost/loops (default 12 steps).
- **TypeScript strict**; `npm run check` + `npm run build` green. Pure logic (`resolveClient`, undo inverse, link-text extraction, zod schemas) is unit-tested; the LLM loop is tested with a mock model + a manual smoke script (never assert on live-model text in CI).
- **Data-handling (spec §8):** never log raw client content; the AI Gateway is zero-retention. `.env*` gitignored.
- Client components `"use client"`; only server code touches the DB or the model. Commit after each task with the repo's two trailers (Co-Authored-By + Claude-Session).

## File Structure

```
lib/db/schema.ts                 # + activity, messages tables (modify)
lib/types.ts                     # + Activity, ChatMessage types (modify)
lib/assistant/
  activity.ts                    # recordActivity, undoActivity, undoTurn, listActivity, snapshot helpers
  activity.test.ts
  resolve.ts                     # resolveClient(query, clients) pure matcher
  resolve.test.ts
  context.ts                     # buildAssistantContext(board): system prompt + roster
  link.ts                        # extractReadableText(html) + fetchLinkText(url)
  link.test.ts
  tools.ts                       # the whitelisted tool set (wraps actions + activity)
  messages.ts                    # loadThread, appendMessage (server)
app/api/assistant/route.ts       # streaming tool-calling agent
components/
  Assistant.tsx                  # useChat panel + drop/paste + slide-over
  ActivityFeed.tsx               # audit trail + undo buttons
  Board.tsx                      # + Assistant trigger, mount panel (modify)
lib/actions.ts                   # + listActivityAction, undoActivityAction, undoTurnAction (modify)
```

---

## Task 1: `activity` + `messages` schema, types, migration

**Files:**
- Modify: `lib/db/schema.ts`, `lib/types.ts`
- Test: none (schema); verified by generate + migrate

**Interfaces:**
- Produces: `activity` and `messages` Drizzle tables; `Activity`, `ActivityInput`, `ChatMessage` types.

- [ ] **Step 1: Add tables to `lib/db/schema.ts`**

```ts
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
```
(`boolean` is already imported in schema.ts? if not, add it to the `drizzle-orm/pg-core` import.)

- [ ] **Step 2: Add types to `lib/types.ts`**

```ts
export interface Activity {
  id: string; createdAt: number; turnId: string;
  actor: "agent" | "user"; tool: string; summary: string;
  entity: "client" | "opportunity"; entityId: string | null;
  beforeImage: unknown | null; undone: boolean;
}
export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; turnId: string; createdAt: number; }
```

- [ ] **Step 3: Generate + apply the migration (live DB is linked)**

```bash
DATABASE_URL="$(node -e 'require("dotenv").config();process.stdout.write(process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL)')" npm run db:generate
DATABASE_URL="$(node -e 'require("dotenv").config();process.stdout.write(process.env.DATABASE_URL_UNPOOLED||process.env.DATABASE_URL)')" npm run db:migrate
```
Expected: a new `lib/db/migrations/000N_*.sql` creating both tables; migration applies cleanly to Neon.

- [ ] **Step 4: Verify + commit**

Run: `npm run check` (clean). Then:
```bash
git add -A && git commit -m "feat(assistant): activity + messages schema and types"
```

---

## Task 2: Activity recording + undo core

**Files:**
- Create: `lib/assistant/activity.ts`, `lib/assistant/activity.test.ts`
- Modify: `lib/actions.ts` (add `listActivityAction`, `undoActivityAction`, `undoTurnAction`)

**Interfaces:**
- Consumes: `db`, `schema`, `normalizeClient`, existing actions.
- Produces:
  - `snapshotClient(id): Promise<Client|null>` / `snapshotOpportunity(id)` — fetch full row for a before-image.
  - `recordActivity(input): Promise<void>` — insert an activity row.
  - `undoActivity(id): Promise<void>` — restore `beforeImage` (upsert prior row) or delete the created row; mark `undone`; record a compensating `undo` activity.
  - `undoTurn(turnId): Promise<void>` — undo all not-yet-undone activities of a turn, newest first.
  - `listActivity(limit=50): Promise<Activity[]>`.
  - Server actions `listActivityAction`, `undoActivityAction(id)`, `undoTurnAction(turnId)` (`'use server'`, `revalidatePath('/')`).

- [ ] **Step 1: Write failing tests** (`lib/assistant/activity.test.ts`)

Test the undo *decision* logic as a pure function so it's DB-free:
```ts
import { describe, it, expect } from "vitest";
import { undoPlan } from "./activity";

describe("undoPlan", () => {
  it("create (no beforeImage) → delete the entity", () => {
    const p = undoPlan({ entity: "client", entityId: "c1", beforeImage: null });
    expect(p).toEqual({ op: "delete", entity: "client", id: "c1" });
  });
  it("update (has beforeImage) → restore the prior row", () => {
    const before = { id: "c1", name: "Old" };
    const p = undoPlan({ entity: "client", entityId: "c1", beforeImage: before });
    expect(p).toEqual({ op: "restore", entity: "client", row: before });
  });
  it("delete (beforeImage is the removed row, entityId null) → reinsert", () => {
    const before = { id: "c9", name: "Gone" };
    const p = undoPlan({ entity: "client", entityId: null, beforeImage: before });
    expect(p).toEqual({ op: "restore", entity: "client", row: before });
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → FAIL (`undoPlan` not exported).

- [ ] **Step 3: Implement `lib/assistant/activity.ts`**

```ts
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { activity, clients, opportunities } from "@/lib/db/schema";
import { normalizeClient } from "@/lib/process";
import type { Activity } from "@/lib/types";

type UndoRef = { entity: "client" | "opportunity"; entityId: string | null; beforeImage: unknown | null };
export type UndoOp =
  | { op: "delete"; entity: "client" | "opportunity"; id: string }
  | { op: "restore"; entity: "client" | "opportunity"; row: any };

/** Pure: decide how to reverse an activity from its before-image. */
export function undoPlan(a: UndoRef): UndoOp {
  if (a.beforeImage == null) return { op: "delete", entity: a.entity, id: a.entityId! };
  return { op: "restore", entity: a.entity, row: a.beforeImage };
}

export async function snapshotClient(id: string) {
  const [row] = await db.select().from(clients).where(eq(clients.id, id));
  return row ?? null;
}
export async function snapshotOpportunity(id: string) {
  const [row] = await db.select().from(opportunities).where(eq(opportunities.id, id));
  return row ?? null;
}

export async function recordActivity(input: Omit<Activity, "id" | "createdAt" | "undone">) {
  await db.insert(activity).values({
    turnId: input.turnId, actor: input.actor, tool: input.tool, summary: input.summary,
    entity: input.entity, entityId: input.entityId, beforeImage: input.beforeImage as any,
  });
}

async function applyUndo(op: UndoOp) {
  const table = op.entity === "client" ? clients : opportunities;
  if (op.op === "delete") { await db.delete(table).where(eq(table.id, op.id)); return; }
  // restore: delete-then-insert the exact prior row (idempotent regardless of exists)
  await db.delete(table).where(eq(table.id, op.row.id));
  await db.insert(table).values(op.row);
}

export async function undoActivity(id: string) {
  const [a] = await db.select().from(activity).where(eq(activity.id, id));
  if (!a || a.undone) return;
  await applyUndo(undoPlan({ entity: a.entity as any, entityId: a.entityId, beforeImage: a.beforeImage }));
  await db.update(activity).set({ undone: true }).where(eq(activity.id, id));
  await recordActivity({
    turnId: a.turnId, actor: "user", tool: "undo", summary: `Undid: ${a.summary}`,
    entity: a.entity as any, entityId: a.entityId, beforeImage: null,
  });
}

export async function undoTurn(turnId: string) {
  const rows = await db.select().from(activity).where(eq(activity.turnId, turnId)).orderBy(desc(activity.createdAt));
  for (const a of rows) if (!a.undone && a.tool !== "undo") await undoActivity(a.id);
}

export async function listActivity(limit = 50): Promise<Activity[]> {
  const rows = await db.select().from(activity).orderBy(desc(activity.createdAt)).limit(limit);
  return rows.map((r) => ({
    id: r.id, createdAt: r.createdAt ? r.createdAt.getTime() : 0, turnId: r.turnId,
    actor: r.actor as any, tool: r.tool, summary: r.summary, entity: r.entity as any,
    entityId: r.entityId, beforeImage: r.beforeImage, undone: r.undone,
  }));
}
```

- [ ] **Step 4: Add the server actions in `lib/actions.ts`**

```ts
import { listActivity, undoActivity, undoTurn } from "@/lib/assistant/activity";
export async function listActivityAction() { return listActivity(); }
export async function undoActivityAction(id: string) { await undoActivity(id); revalidatePath("/"); }
export async function undoTurnAction(turnId: string) { await undoTurn(turnId); revalidatePath("/"); }
```

- [ ] **Step 5: Run tests + check** — `npm test && npm run check` → green.

- [ ] **Step 6: Commit** — `git commit -am "feat(assistant): activity recording + undo core"`

---

## Task 3: Client inference resolver + context assembly

**Files:**
- Create: `lib/assistant/resolve.ts`, `lib/assistant/resolve.test.ts`, `lib/assistant/context.ts`

**Interfaces:**
- Consumes: `Client`, `Board`, `PROCESS`.
- Produces:
  - `resolveClient(query: string, clients: Client[]): { id: string; confidence: "exact"|"partial" } | null` — case-insensitive exact, then substring/word match on name; null if none/ambiguous.
  - `buildAssistantContext(board): string` — the system prompt: what the tool does, the client roster (id + name + phase + a few keywords), the opportunity list, the canonical PROCESS step ids/labels, and the auto-apply/undo rules.

- [ ] **Step 1: Write failing tests** (`resolve.test.ts`)
```ts
import { describe, it, expect } from "vitest";
import { resolveClient } from "./resolve";
const clients = [{ id: "a", name: "Rivet Health" }, { id: "b", name: "Topminnow" }] as any;
describe("resolveClient", () => {
  it("exact (case-insensitive)", () => expect(resolveClient("rivet health", clients)).toEqual({ id: "a", confidence: "exact" }));
  it("partial word", () => expect(resolveClient("the rivet call", clients)).toEqual({ id: "a", confidence: "partial" }));
  it("no match → null", () => expect(resolveClient("acme", clients)).toBeNull());
  it("ambiguous multiple partials → null", () => {
    const two = [{ id: "a", name: "Rivet Health" }, { id: "c", name: "Rivet Labs" }] as any;
    expect(resolveClient("rivet", two)).toBeNull();
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `resolve.ts`**
```ts
import type { Client } from "@/lib/types";
export function resolveClient(query: string, clients: Client[]) {
  const q = query.toLowerCase();
  const exact = clients.find((c) => c.name && q.includes(c.name.toLowerCase()) && c.name.toLowerCase() === q.trim());
  if (exact) return { id: exact.id, confidence: "exact" as const };
  const nameHits = clients.filter((c) => c.name && q.includes(c.name.toLowerCase()));
  if (nameHits.length === 1) return { id: nameHits[0].id, confidence: "exact" as const };
  const wordHits = clients.filter((c) => c.name && c.name.toLowerCase().split(/\s+/).some((w) => w.length > 2 && q.includes(w)));
  if (wordHits.length === 1) return { id: wordHits[0].id, confidence: "partial" as const };
  return null;
}
```

- [ ] **Step 4: Implement `context.ts`** (no test — string builder; exercised via the route)
```ts
import type { Board } from "@/lib/types";
import { PROCESS } from "@/lib/process";
export function buildAssistantContext(board: Board): string {
  const roster = board.clients.map((c) => `- ${c.name} (id=${c.id}) — phase ${c.phase}, ${c.status}`).join("\n");
  const opps = board.opportunities.map((o) => `- ${o.name} (id=${o.id}) — ${o.stage}`).join("\n");
  const steps = PROCESS.map((p) => `${p.label}: ${p.steps.map((s) => s.id).join(", ")}`).join("\n");
  return [
    "You maintain a SeeSaw Labs client engagement board. When the user tells you what happened, or pastes a transcript/link, infer which client and CALL TOOLS to update the board. Auto-apply — do not ask for permission for normal edits; every change is logged and undoable. For deletes, ask first (pass confirmed:true only after the user confirms). If you cannot tell which client, ask one short question or create a new one.",
    "Status vocab: todo, doing, done, validated, skipped(requires a why note), na.",
    `Clients:\n${roster || "(none)"}`,
    `Opportunities:\n${opps || "(none)"}`,
    `Canonical process step ids by phase:\n${steps}`,
  ].join("\n\n");
}
```

- [ ] **Step 5: Tests + check + commit** — `npm test && npm run check`; `git commit -am "feat(assistant): client resolver + context builder"`

---

## Task 4: Tool layer

**Files:**
- Create: `lib/assistant/tools.ts`
- Modify: `lib/actions.ts` if a needed mutation isn't exported (it is: `upsertClient`, `saveStep`, `upsertOpportunity`, `deleteClient`, `deleteOpportunity`, `getBoard`).

**Interfaces:**
- Consumes: the actions, `snapshotClient`/`snapshotOpportunity`/`recordActivity`, `normalizeClient`, Zod.
- Produces: `buildTools(turnId: string)` → an object of AI SDK `tool()` definitions. Each mutating tool snapshots the before-image, runs the action, records activity, returns a short result string.

- [ ] **Step 1: Implement `tools.ts`** (CONFIRM `tool()`/`inputSchema` shape against AI SDK v6 docs)
```ts
import { tool } from "ai";
import { z } from "zod";
import { getBoard, upsertClient, saveStep, deleteClient, upsertOpportunity, deleteOpportunity } from "@/lib/actions";
import { snapshotClient, snapshotOpportunity, recordActivity } from "./activity";
import { resolveClient } from "./resolve";

export function buildTools(turnId: string) {
  return {
    queryBoard: tool({
      description: "Read the board. Use to find a client/opportunity id or answer questions.",
      inputSchema: z.object({ q: z.string().describe("what you're looking for") }),
      execute: async ({ q }) => {
        const board = await getBoard();
        const match = resolveClient(q, board.clients);
        return JSON.stringify({ clients: board.clients.map((c) => ({ id: c.id, name: c.name, phase: c.phase, status: c.status })), match });
      },
    }),
    upsertClient: tool({
      description: "Create or update a client's deal fields. Omit id to create. Only pass fields you want to change.",
      inputSchema: z.object({
        id: z.string().optional(),
        patch: z.record(z.string(), z.any()).describe("partial Client: name, summary, start, end, phase, status, billing, contractValue, buildUrl, opportunity, assignments, risks, needs, findings, entryPoint"),
      }),
      execute: async ({ id, patch }) => {
        const before = id ? await snapshotClient(id) : null;
        const merged = id ? { ...(before as any), ...patch, id } : patch;
        await upsertClient(merged as any);
        const board = await getBoard();
        const saved = board.clients.find((c) => (id ? c.id === id : c.name === (patch as any).name));
        await recordActivity({ turnId, actor: "agent", tool: "upsertClient", entity: "client", entityId: saved?.id ?? id ?? null, beforeImage: before, summary: id ? `Updated ${saved?.name ?? "client"}` : `Created ${(patch as any).name}` });
        return `ok: ${id ? "updated" : "created"} ${saved?.name ?? (patch as any).name}`;
      },
    }),
    setStep: tool({
      description: "Set a process step's status/note/decisions for a client. status ∈ todo|doing|done|validated|skipped|na. skipped requires a note.",
      inputSchema: z.object({
        clientId: z.string(),
        stepId: z.string(),
        status: z.enum(["todo", "doing", "done", "validated", "skipped", "na"]),
        note: z.string().optional(),
        decisions: z.array(z.object({ what: z.string(), why: z.string() })).optional(),
      }),
      execute: async ({ clientId, stepId, status, note, decisions }) => {
        if (status === "skipped" && !note?.trim()) return "error: skipped requires a note (the why)";
        const before = await snapshotClient(clientId);
        await saveStep(clientId, stepId, { status, note: note ?? "", ...(decisions ? { decisions } : {}) } as any);
        await recordActivity({ turnId, actor: "agent", tool: "setStep", entity: "client", entityId: clientId, beforeImage: before, summary: `${stepId} → ${status}${note ? ` (${note})` : ""}` });
        return `ok: ${stepId} set to ${status}`;
      },
    }),
    upsertOpportunity: tool({
      description: "Create or update a pipeline opportunity. Omit id to create.",
      inputSchema: z.object({ id: z.string().optional(), patch: z.record(z.string(), z.any()) }),
      execute: async ({ id, patch }) => {
        const before = id ? await snapshotOpportunity(id) : null;
        await upsertOpportunity({ ...(id ? { id } : {}), ...patch } as any);
        await recordActivity({ turnId, actor: "agent", tool: "upsertOpportunity", entity: "opportunity", entityId: id ?? null, beforeImage: before, summary: id ? `Updated opportunity` : `Created opportunity ${(patch as any).name}` });
        return "ok";
      },
    }),
    deleteClient: tool({
      description: "Delete a client. DESTRUCTIVE — only call with confirmed:true after the user explicitly confirms.",
      inputSchema: z.object({ id: z.string(), confirmed: z.boolean() }),
      execute: async ({ id, confirmed }) => {
        if (!confirmed) return "not confirmed: ask the user to confirm deletion first";
        const before = await snapshotClient(id);
        await deleteClient(id);
        await recordActivity({ turnId, actor: "agent", tool: "deleteClient", entity: "client", entityId: id, beforeImage: before, summary: `Deleted ${(before as any)?.name ?? "client"}` });
        return "ok: deleted (undoable)";
      },
    }),
  };
}
```
NOTE on undo of a create: `entityId` is set from the saved row, `beforeImage` is null → `undoPlan` returns a delete. Good.

- [ ] **Step 2: Check + commit** — `npm run check` (green); `git commit -am "feat(assistant): whitelisted tool layer over actions + activity"`
  (No unit test here — tools are thin wrappers; the plumbing is exercised by the route's mock-model test in Task 5 and the smoke in Task 9. The skipped-note guard and the confirm guard are the only branch logic; if you want, add a focused test calling `buildTools("t").setStep.execute` against a seeded test row.)

---

## Task 5: `/api/assistant` route (streaming tool-calling agent)

**Files:**
- Create: `app/api/assistant/route.ts`, `lib/assistant/messages.ts`

**Interfaces:**
- Consumes: `streamText`, `stepCountIs` (AI SDK v6), `buildTools`, `buildAssistantContext`, `getBoard`, message persistence.
- Produces: `POST /api/assistant` streaming response; persists user + assistant messages under a `turnId`.

- [ ] **Step 1: Message persistence** (`lib/assistant/messages.ts`)
```ts
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
export async function appendMessage(m: { turnId: string; role: "user" | "assistant"; content: string }) {
  await db.insert(messages).values(m);
}
export async function loadThread(limit = 100): Promise<ChatMessage[]> {
  const rows = await db.select().from(messages).orderBy(desc(messages.createdAt)).limit(limit);
  return rows.reverse().map((r) => ({ id: r.id, role: r.role as any, content: r.content, turnId: r.turnId, createdAt: r.createdAt ? r.createdAt.getTime() : 0 }));
}
```

- [ ] **Step 2: The route** (CONFIRM v6 signatures — `streamText`, `tools`, `stopWhen: stepCountIs(n)`, `toUIMessageStreamResponse`, and how to read `messages` from the request — via the `vercel:ai-sdk` skill / Context7)
```ts
import { streamText, stepCountIs, convertToModelMessages } from "ai";
import { getBoard } from "@/lib/actions";
import { buildTools } from "@/lib/assistant/tools";
import { buildAssistantContext } from "@/lib/assistant/context";
import { appendMessage } from "@/lib/assistant/messages";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages, turnId } = await req.json();
  const board = await getBoard();
  const system = buildAssistantContext(board);
  const last = messages[messages.length - 1];
  if (last?.role === "user") await appendMessage({ turnId, role: "user", content: extractText(last) });

  const result = streamText({
    model: "anthropic/claude-sonnet-5", // AI Gateway; confirm exact id
    system,
    messages: convertToModelMessages(messages),
    tools: buildTools(turnId),
    stopWhen: stepCountIs(12),
    onFinish: async ({ text }) => { if (text?.trim()) await appendMessage({ turnId, role: "assistant", content: text }); },
  });
  return result.toUIMessageStreamResponse();
}

function extractText(m: any): string {
  if (typeof m.content === "string") return m.content;
  return (m.parts ?? []).filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n");
}
```

- [ ] **Step 3: Verify build** — `npm run check && npm run build` green. (No live-model assertion in CI.)

- [ ] **Step 4: Mock-model plumbing test (optional but recommended)** — if the AI SDK exposes a mock/simulated model in v6, add a test that feeds a canned tool-call and asserts the tool ran + an activity row was written. If v6's mock API is unclear, SKIP and rely on Task 9's smoke — note the skip.

- [ ] **Step 5: Commit** — `git commit -am "feat(assistant): streaming tool-calling /api/assistant route"`

---

## Task 6: Global assistant chat UI

**Files:**
- Create: `components/Assistant.tsx`
- Modify: `components/Board.tsx` (trigger button + mount)

**Interfaces:**
- Consumes: `useChat` (`@ai-sdk/react`, v6 — CONFIRM: `transport`/`api`, `sendMessage`, `messages`, `status`), `useRouter`.
- Produces: a slide-over assistant panel; on turn finish, `router.refresh()` so board reflects changes.

- [ ] **Step 1: Implement `Assistant.tsx`** (`"use client"`; confirm useChat v6 shape)
```tsx
"use client";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/process";

export function Assistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [turnId] = useState(() => Math.random().toString(36).slice(2));
  const { messages, sendMessage, status } = useChat({
    api: "/api/assistant",
    body: { turnId },
    onFinish: () => router.refresh(), // board picks up applied changes
  });
  const [input, setInput] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-md bg-white shadow-xl flex flex-col" style={{ borderLeft: `4px solid ${BRAND.navy}` }}>
      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "#E2E6ED" }}>
        <span className="font-semibold" style={{ color: BRAND.navy, fontFamily: "'Fraunces',serif" }}>Assistant</span>
        <button onClick={onClose} style={{ color: "#66707F" }}>✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <div className="text-[11px] uppercase tracking-wide" style={{ color: "#8A93A3" }}>{m.role}</div>
            <div style={{ color: BRAND.ink }}>{renderParts(m)}</div>
          </div>
        ))}
        {status === "streaming" && <div className="text-xs" style={{ color: "#8A93A3" }}>…</div>}
      </div>
      <form className="p-3 border-t flex gap-2" style={{ borderColor: "#E2E6ED" }}
        onSubmit={(e) => { e.preventDefault(); if (!input.trim()) return; sendMessage({ text: input }); setInput(""); }}>
        <textarea rows={2} className="flex-1 border rounded-md px-3 py-2 text-sm" style={{ borderColor: "#D3D9E2" }}
          placeholder="What happened? Paste a transcript or a link…" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as any).form.requestSubmit(); } }} />
        <button className="px-3 rounded-md text-white text-sm font-semibold" style={{ background: BRAND.navy }}>Send</button>
      </form>
    </div>
  );
}
function renderParts(m: any) {
  // v6 UIMessage has parts; render text parts, and show tool activity compactly. CONFIRM part shape.
  if (typeof m.content === "string") return m.content;
  return (m.parts ?? []).map((p: any, i: number) =>
    p.type === "text" ? <span key={i}>{p.text}</span> :
    p.type?.startsWith("tool-") ? <span key={i} className="block text-[11px]" style={{ color: "#2B6CB0" }}>▸ {p.type.replace("tool-", "")}</span> : null);
}
```

- [ ] **Step 2: Add trigger + mount in `Board.tsx`** — an "Assistant" button in the header controls that toggles `const [assistantOpen, setAssistantOpen] = useState(false)`, and `<Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />` at the end of the returned tree.

- [ ] **Step 3: Install deps** — `npm i ai @ai-sdk/react zod` (confirm current majors for v6). Then `npm run check && npm run build`.

- [ ] **Step 4: Commit** — `git commit -am "feat(assistant): global chat panel wired to the agent"`

---

## Task 7: Activity feed + undo UI

**Files:**
- Create: `components/ActivityFeed.tsx`
- Modify: `components/Board.tsx` (render the feed — e.g. inside the assistant panel or a header popover) and `app/page.tsx` (pass initial activity).

**Interfaces:**
- Consumes: `listActivityAction`, `undoActivityAction`, `undoTurnAction`, `Activity`.
- Produces: a feed grouped by `turnId`, each entry showing `summary` + time, with **Undo** (per entry) and **Undo all** (per turn); `router.refresh()` after.

- [ ] **Step 1: Fetch initial activity in `app/page.tsx`** — `const activity = await listActivityAction();` pass to `<Board initial={board} activity={activity} />`.

- [ ] **Step 2: Implement `ActivityFeed.tsx`** (`"use client"`)
```tsx
"use client";
import { useRouter } from "next/navigation";
import { undoActivityAction, undoTurnAction } from "@/lib/actions";
import { BRAND } from "@/lib/process";
import type { Activity } from "@/lib/types";

export function ActivityFeed({ activity }: { activity: Activity[] }) {
  const router = useRouter();
  const turns = groupByTurn(activity.filter((a) => a.tool !== "undo"));
  return (
    <div className="space-y-3">
      {turns.map((t) => (
        <div key={t.turnId} className="rounded-md border p-3" style={{ borderColor: "#E2E6ED" }}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px]" style={{ color: "#8A93A3" }}>{new Date(t.at).toLocaleString()}</span>
            {t.items.some((i) => !i.undone) && (
              <button className="text-xs font-semibold" style={{ color: BRAND.red }}
                onClick={async () => { await undoTurnAction(t.turnId); router.refresh(); }}>Undo all</button>
            )}
          </div>
          {t.items.map((a) => (
            <div key={a.id} className="flex justify-between items-start gap-2 text-sm">
              <span style={{ color: a.undone ? "#A0AAB8" : BRAND.ink, textDecoration: a.undone ? "line-through" : "none" }}>✓ {a.summary}</span>
              {!a.undone && <button className="text-xs" style={{ color: "#66707F" }}
                onClick={async () => { await undoActivityAction(a.id); router.refresh(); }}>undo</button>}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
function groupByTurn(a: Activity[]) {
  const m = new Map<string, { turnId: string; at: number; items: Activity[] }>();
  for (const x of a) { if (!m.has(x.turnId)) m.set(x.turnId, { turnId: x.turnId, at: x.createdAt, items: [] }); m.get(x.turnId)!.items.push(x); }
  return [...m.values()].sort((p, q) => q.at - p.at);
}
```

- [ ] **Step 3: Render it** (inside the Assistant panel footer or a board popover). Keep it visible where changes happen.

- [ ] **Step 4: Check/build + commit** — `npm run check && npm run build`; `git commit -am "feat(assistant): activity feed with per-entry and per-turn undo"`

---

## Task 8: Link-paste ingestion

**Files:**
- Create: `lib/assistant/link.ts`, `lib/assistant/link.test.ts`
- Modify: `lib/assistant/tools.ts` (add a `readLink` tool)

**Interfaces:**
- Produces: `extractReadableText(html: string): string` (pure — strip tags/scripts, collapse whitespace); `fetchLinkText(url: string): Promise<string>` (fetch + extract, cap length); a `readLink` tool the agent calls when a URL is present.

- [ ] **Step 1: Failing test** (`link.test.ts`)
```ts
import { describe, it, expect } from "vitest";
import { extractReadableText } from "./link";
describe("extractReadableText", () => {
  it("strips scripts/tags and collapses whitespace", () => {
    const html = "<html><head><script>x=1</script><style>a{}</style></head><body><h1>Hi</h1><p>Call notes:\n\n  HIPAA   ok</p></body></html>";
    const t = extractReadableText(html);
    expect(t).toContain("Hi");
    expect(t).toContain("Call notes: HIPAA ok");
    expect(t).not.toContain("x=1");
    expect(t).not.toContain("<");
  });
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `link.ts`**
```ts
export function extractReadableText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}
export async function fetchLinkText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 SeeSawBoard" } });
  if (!res.ok) return `error: could not fetch ${url} (${res.status})`;
  const html = await res.text();
  return extractReadableText(html).slice(0, 8000);
}
```

- [ ] **Step 4: Add the `readLink` tool** in `tools.ts`:
```ts
readLink: tool({
  description: "Fetch a URL the user pasted and return its readable text so you can act on it.",
  inputSchema: z.object({ url: z.string().url() }),
  execute: async ({ url }) => (await import("./link")).fetchLinkText(url),
}),
```

- [ ] **Step 5: Tests + check + commit** — `npm test && npm run check`; `git commit -am "feat(assistant): link-paste ingestion via readLink tool"`

---

## Task 9: Integration smoke, docs, deploy

**Files:** Modify: `README.md`, `AGENTS.md`

- [ ] **Step 1: Full verification** — `npm test && npm run check && npm run build` all green.

- [ ] **Step 2: Live smoke script** — with `.env` (has `DATABASE_URL` + `VERCEL_OIDC_TOKEN`), run the dev server and drive the assistant with real prompts:
  1. "Kickoff with new client Acme, fintech, greenfield, $120k, I'm lead." → a client is created; activity shows it; board shows Acme.
  2. "Rivet call went well, HIPAA sorted, moving to build." → Rivet phase→Develop, `dev_security` → validated with a note, HIPAA risk removed; activity logged.
  3. Click **Undo all** on turn 2 → Rivet reverts exactly.
  4. Paste a public URL + "add anything relevant to Acme" → `readLink` runs; a finding/note is added.
  Record results in the report. (Manual — not CI.)

- [ ] **Step 3: Docs** — add an "AI Assistant" section to `README.md` (what it does, the `/api/assistant` route, the `activity`/`messages` tables, the AI Gateway model + that auth is via OIDC). Note in `AGENTS.md` that assistant logic lives in `lib/assistant/` and the agent may only call the tools in `tools.ts`.

- [ ] **Step 4: Migrate prod + deploy** — the new migration was applied to Neon in Task 1 (same DB serves prod). Deploy: `vercel deploy --prod --yes --scope see-saw-labs`. Confirm the model call works in prod (OIDC auth is automatic on Vercel). If the AI Gateway needs enabling for the team, do so in the Vercel dashboard.

- [ ] **Step 5: Commit + tag** — `git commit -am "docs(assistant): phase-1 usage + deploy notes"`; `git tag -a v1.1-assistant -m "AI assistant phase 1"`; `git push origin main --tags`.

---

## Self-Review (plan author)

**Spec coverage (§7):** global chat that infers client → Tasks 3,5,6 · auto-apply via tools wrapping actions → Task 4 · activity log + before-image + undo (per-entry + per-turn) → Tasks 2,7 · client inference → Task 3 · conversation persistence → Task 5 · text-in → Tasks 5,6 · link-paste → Task 8 · turn cap + tool whitelist + destructive-confirm → Tasks 4,5 · testing (pure units + mock/smoke) → Tasks 2,3,8,5,9. File upload / docs-out / proactive are explicitly Phases 2–4, out of this plan.

**Placeholder scan:** the AI-SDK-specific blocks (Tasks 5,6) carry an explicit "confirm v6 signatures via the vercel:ai-sdk skill/Context7" instruction rather than pinning possibly-stale APIs — deliberate for a fast-moving external SDK, not hand-waving; all logic/schema/tool code is complete. Task 4's test is marked optional with the reason (thin wrappers, covered by route/smoke).

**Type consistency:** `Activity` shape identical across schema (Task 1), activity.ts (Task 2), actions, and ActivityFeed (Task 7). `undoPlan`/`UndoOp` used only in activity.ts. Tool `execute` before-image capture (Task 4) matches `recordActivity`/`undoPlan` (create → null beforeImage → delete; update/delete → row beforeImage → restore). `turnId` threads route → tools → activity → feed grouping consistently.

**Risk flags for the executor:** (1) AI SDK v6 exact API is the main unknown — Tasks 5/6 must verify. (2) The mock-model test (Task 5.4) may not be feasible depending on v6's test utilities — smoke (Task 9.2) is the backstop. (3) AI Gateway may need enabling for the team in Vercel.
