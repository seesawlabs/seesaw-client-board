# SeeSaw Client Board — Product Spec

Single source of truth for what this tool is and how it's built. Update
this doc when the design changes; keep `AGENTS.md` as a thin pointer to it.

Architecture decisions are recorded in `docs/adr/`.

---

## 1. What this is

A shared, internal team app for SeeSaw Labs that tracks every client engagement
against SSL's **canonical product-development process**, run flexibly per
client. It answers, at a glance:

- What engagements are active, what's the deal behind each, and are we on track?
- Where is each client in our process — and **which steps are we skipping or
  retro-validating, and why**?
- Who's allocated to what, and is anyone over/under-loaded?

### How it runs (platform)

A **Next.js (App Router) app deployed on Vercel**, backed by **Neon Postgres**
(via Drizzle ORM). Access is gated by **Vercel deployment protection** — no
auth code in v1; the whole app sits behind the platform's team/password gate.
See ADRs 0001–0003.

- **Previously** a Claude.ai artifact using `window.storage`; rolled out into a
  standalone app (ADR 0001). The old artifact is abandoned; data starts fresh.
- **Publishing** is now `git push` → Vercel preview (PRs) and production (main).
- **No per-user identity in v1** — it's a shared board (like the artifact was
  "whoever has the link"). Assignment "people" are data, not logged-in users.

---

## 2. Goals / non-goals

**Goals (v1)**
- Define SSL's canonical 5D process as fixed, expanded, best-practice IP.
- Track each client as a flexible *instance* of that process — meet clients
  where they are (greenfield vs mid-build), skip/validate steps with reasons.
- Capture the "deal layer" per client (billable?, the real opportunity, contract
  value, the build link, dates, status, resourcing).
- A resource view to spot over/under-allocation.
- Capture key decisions (what + why) at the step level.
- Real persistence (Neon), a stable protected URL, git-push deploys.

**Goals (v2 — fast-follow, designed-for but not built now)**
- Paste **or upload** per-client context (sales-call notes, docs, links) and
  have AI *propose* a tailored process instance (entry point, steps to
  skip/add, why), which a human reviews and accepts. AI proposes; humans run.
  Real file uploads (Vercel Blob) are now feasible — a key reason for going
  standalone.

**Non-goals (v1)**
- No per-user auth, roles, or audit trail (deployment protection only, ADR 0003).
- Not a billing, CRM, or PM system — it's an alignment board.
- No real-time multiplayer sync; mutations revalidate + a manual refresh suffice.

---

## 3. The model: three layers

The board is organized as three distinct layers. Layers 1 and 2 attach to each
client; layer 3 is a cross-cutting view over all clients. This design is
platform-independent — it carried over unchanged from the artifact version.

### Layer 1 — Deal / overview (per client)

The "what is this engagement and why."

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `summary` | string | one-liner |
| `start`, `end` | date (ISO string) | drives the calendar |
| `status` | enum | On Track / At Risk / Blocked / Wrapping |
| `phase` | enum | current focus phase (Discover…Deploy); drives timeline label |
| `billing` | enum | `billable` \| `internal` (SSL side project) |
| `opportunity` | `{ types[], note }` | the real thing we're driving toward |
| `contractValue` | number \| null | total $; shows "Internal / non-billable" when `billing = internal` |
| `buildUrl` | string | first-class link to what we/they built → persistent "See the build ↗" button |
| `assignments` | `{ name, role, load }[]` | who's on it + allocation |
| `risks`, `needs`, `findings` | string[] | detail lists |
| `links` | `{ label, url }[]` | generic links (separate from `buildUrl`) |
| `entryPoint` | `{ mode, atStep }` | greenfield vs mid-build (see Layer 2) |
| `process` | map keyed by step id | the process instance (see Layer 2) |

**`opportunity.types`** — multi-select from a fixed set (plus free-text `note`):
`expansion` (more work) · `referrals` · `cosell` (partnership) · `ssl_ip`
(build IP for SSL to sell).

**`assignments[]`** — each: `name`, `role` (e.g. "Eng", "Design"), `load` enum
`lead` (heavy) \| `core` (medium) \| `light`.

### Layer 2 — Process (the 5D, per client)

The canonical process is **fixed** (section 4). Each client holds a `process`
map keyed by **step id** (not array position), so the template can grow or be
renamed later without corrupting existing client data — unknown/new steps render
as "Not started."

**Per-step instance** — `process[stepId]`:
```
{
  status: "todo" | "doing" | "done" | "validated" | "skipped" | "na",
  note:   string,                 // required when skipped (the "why")
  decisions: { what, why }[]      // optional key-decision log for this step
}
```

**Status vocabulary:**

| status | icon | meaning | note used for |
|---|---|---|---|
| `todo` | ○ | planned, upcoming | — |
| `doing` | ◐ | actively doing | — |
| `done` | ✓ | we completed it | — |
| `validated` | ✓ | client/prior work existed — we reviewed & validated it | what we checked / value added |
| `skipped` | ⊘ | deliberately not doing | **why (required)** |
| `na` | — | genuinely doesn't apply | optional |

**Entry point** — `entryPoint: { mode, atStep }` drives smart defaults (all
overridable per step):
- `greenfield` — every step defaults to `todo`; work top-down.
- `mid-build` — `atStep` marks where the client came in. Steps *before* it
  default to `validated` (prompt: "what did we review + value added / gaps
  found?"); the entry step and after are our process going forward.

**Roll-ups (computed, not stored):**
- Per phase: `done+validated / applicable` and a skipped count → `Define · 3/5 · 1 skipped`.
- Per client: overall % of *applicable* (non-`na`) steps done/validated.
- Per client: a **"Deliberately skipped / N-A — and why"** panel auto-built from
  `skipped` + `na` steps. The client-conversation artifact.

### Layer 3 — Resource view (cross-cutting)

A toggle that flips the board from "by client" to "by person." For each person
across all active clients: their assignments (client · role · load) and a
capacity read summed from `load` buckets (lead=3, core=2, light=1), flagging
anyone whose total exceeds `CAPACITY` (=5). Read-only aggregation computed in app
code; editing still happens on the client.

---

## 4. Canonical 5D process (fixed IP — 25 steps)

Five steps per phase. Step ids are stable keys; labels/hints may be edited
without data loss. `megamine: true` marks the Megamine ramp-up step.

**Discover** — understand the problem, domain, and whether to build
- `dsc_rampup` — Industry & business ramp-up *(Megamine)*
- `dsc_stakeholders` — Stakeholder & goal alignment
- `dsc_research` — User & problem research
- `dsc_competitive` — Competitive & landscape teardown
- `dsc_feasibility` — Opportunity & feasibility read

**Define** — lock scope, success criteria, and the plan
- `def_metrics` — Success metrics & goals
- `def_scope` — Scope & SOW
- `def_requirements` — Solution concept & requirements
- `def_architecture` — Technical approach & architecture
- `def_roadmap` — Roadmap & milestones

**Design** — make it concrete and validate before heavy build
- `dsn_ia` — Information architecture & flows
- `dsn_wireframes` — Wireframes & prototype
- `dsn_ui` — UI & visual design
- `dsn_validation` — Design validation
- `dsn_handoff` — Design-to-dev handoff

**Develop** — build it
- `dev_scaffold` — Environment & scaffolding
- `dev_build` — Core build (iterative)
- `dev_integrations` — Integrations & data
- `dev_qa` — QA & testing
- `dev_security` — Security, data & compliance review

**Deploy** — ship, hand off, set up for success
- `dep_readiness` — Launch readiness
- `dep_release` — Production deploy
- `dep_observability` — Monitoring & observability
- `dep_handoff` — Handoff & enablement
- `dep_review` — Post-launch review (measure vs. Define's success metrics)

---

## 5. UI / UX

Keep the visual system from the artifact (BRAND palette — navy `#152238`, red
`#E4413F`, blue `#2B6CB0`, paper `#F7F5F1`; Fraunces + Archivo fonts; the
calendar/timeline; the opportunity pipeline). The layout ports directly; only
the data plumbing changes.

**Header** — a **view toggle: "By client" / "By resource."**

**Client card (collapsed)** — name, status, phase tracker, plus deal signals:
billing badge (Billable / Internal), contract value, overall process %, the
**"See the build ↗"** button when `buildUrl` is set, and opportunity chips.

**Client card (expanded)** — a **Process** section is the centerpiece:
- 5 phase groups, each header showing its roll-up.
- Each step is a row: status icon · label · note · decisions count.
- **Click a step** → an inline editor (modal) to set status, edit the note, and
  add `what/why` decisions.
- The **"Deliberately skipped / N-A — and why"** panel.
- Existing Risks / Needs / Findings / Links remain.

**Client editor** — deal-layer fields (billing, opportunity multi-select + note,
contract value, build URL), `assignments` (name · role · load), and the **entry
point** picker (greenfield vs mid-build + step) that seeds process defaults.

**Resource view** — grouped by person: each person's assignments (client · role ·
load dots) and an over/under-allocation flag.

**Timeline / 5D tracker** — the existing calendar and phase tracker; a phase
reads "complete" when all its *applicable* steps are done/validated.

---

## 6. Data model & persistence

**Two tables** (Drizzle schema, `lib/db/schema.ts`). Nested per-client structures
are **JSONB columns** so the pure logic operates on them unchanged (ADR 0002).

`clients`
- `id` uuid pk · `name` text · `summary` text
- `start` text · `end` text · `phase` text · `status` text
- `billing` text · `contractValue` integer null · `buildUrl` text
- `opportunity` jsonb `{ types: string[], note: string }`
- `assignments` jsonb `{ name, role, load }[]`
- `risks` jsonb `string[]` · `needs` jsonb `string[]` · `findings` jsonb `string[]`
- `links` jsonb `{ label, url }[]`
- `entryPoint` jsonb `{ mode, atStep }`
- `process` jsonb `{ [stepId]: { status, note, decisions } }`
- `createdAt` timestamptz · `updatedAt` timestamptz

`opportunities`
- `id` uuid pk · `name` · `industry` · `stage` · `contact` · `notes` ·
  `expertiseAsk` · `createdAt` · `updatedAt`

**Access layer** — server actions in `lib/actions.ts` (`'use server'`):
`getBoard()`, `upsertClient(input)`, `deleteClient(id)`, `saveStep(clientId,
stepId, patch)`, `upsertOpportunity(input)`, `deleteOpportunity(id)`. Client
components call these; each mutation `revalidatePath('/')`.

**`normalizeClient`** stays — now a pure function in `lib/process.ts`, applied on
**read** (defensive: DB rows always render whole even after a template/field
change) and on **write** (every upsert is well-formed). Same contract as the
artifact version: guarantees all deal fields, `assignments`, `entryPoint`, and a
full `process` map for all 25 step ids.

**Fresh start:** no migration from the artifact's `window.storage`. A seed script
(`scripts/seed.ts`) populates two example clients (one greenfield, one mid-build)
and one opportunity for local/first-deploy demoing.

---

## 7. v2 — AI context tailoring (designed-for, not built now)

**Input:** a per-client **Context** area — paste transcript/doc text + labeled
links, **and (now feasible) upload files** to Vercel Blob (PDFs, decks).

**Action:** a server route sends the context + the canonical process to an LLM
(via the Vercel AI SDK / AI Gateway) and returns a *proposed* instance: suggested
`entryPoint`, per-step skip/validate/add recommendations each with a drafted
`why`, and any industry-specific step additions. Rendered as **suggestions the
human reviews, edits, and accepts** — nothing auto-applied.

Being standalone (real server + Blob + AI SDK) is what makes this a clean build
rather than the artifact's paste-only workaround.

---

## 8. Data-handling & security

Now a real app with confidential data (contract values, client notes, v2
sales-call context). Baseline (SeeSauce `security-baseline` / `data-handling`):
- **Access:** Vercel deployment protection on all environments (prod + preview).
- **Secrets:** `DATABASE_URL` and any AI keys via Vercel env vars / OIDC — never
  committed. `.env*` gitignored.
- **Data minimization:** store summaries over raw transcripts where practical;
  don't log client data in server actions.
- **Retention:** deletes are hard deletes in v1; revisit if audit needs arise.
- Revisit access control when the first per-user feature lands (ADR 0003).

---

## 9. Open questions / assumptions

- **Assumed:** the 25-step process is SSL's default (confirmed in brainstorming).
  Editable per client via skip/na; template edits are code changes.
- **Assumed:** `phase` stays an explicit field for the timeline; roll-ups are
  computed from `process`. Deriving `phase` from the furthest active step is
  deferred.
- **Deferred:** a canonical `people` table (vs free-text assignment names) —
  revisit with the resource view if typos bite (ADR 0002/0003).
- **v2:** file uploads (Vercel Blob) + AI provider wiring (AI SDK/Gateway) —
  separate spec + plan.
