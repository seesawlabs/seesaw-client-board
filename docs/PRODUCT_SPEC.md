# SeeSaw Client Board — Product Spec

Single source of truth for what this tool is and how it's built. Update
this doc when the design changes; keep `AGENTS.md` as a thin pointer to it.

---

## 1. What this is

A shared, editable team board for SeeSaw Labs that tracks every client
engagement against SSL's **canonical product-development process**, run
flexibly per client. It answers, at a glance:

- What engagements are active, what's the deal behind each, and are we on track?
- Where is each client in our process — and **which steps are we skipping or
  retro-validating, and why**?
- Who's allocated to what, and is anyone over/under-loaded?

### How it runs (important constraint)

This is **not a deployed web app**. It's a single-file React component
(`dashboard.jsx`) that runs as a **Claude.ai artifact**. Shared state lives in
`window.storage` (an API that only exists inside Claude.ai artifacts), scoped to
one artifact link — that link *is* the database. There is no backend.

Consequences that shape every design decision below:
- No server, no API keys, no file system, no auth beyond "who has the link."
- Data is a single JSON blob under one storage key.
- The repo is for version control / review; publishing = pasting the updated
  `dashboard.jsx` into the live artifact (see root `README.md`).
- Anything needing real file uploads, stored documents, or reliable server-side
  AI is a **future standalone build**, out of scope here.

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

**Goals (v2 — fast-follow, designed-for but not built now)**
- Paste per-client context (sales-call notes, doc text, links) and have AI
  *propose* a tailored process instance (entry point, steps to skip/add, why),
  which a human reviews and accepts. AI proposes; humans run.

**Non-goals**
- No backend, real file uploads, or standalone deployment (separate project).
- No auth / permissions / audit — trust model is "who has the artifact link."
- Not a billing, CRM, or PM system — it's an alignment board.

---

## 3. The model: three layers

The board is organized as three distinct layers. Layers 1 and 2 attach to each
client; layer 3 is a cross-cutting view over all clients.

### Layer 1 — Deal / overview (per client)

The "what is this engagement and why." Fields (★ = new in this spec):

| Field | Type | Notes |
|---|---|---|
| `name` | string | existing |
| `summary` | string | one-liner, existing |
| `start`, `end` | date | existing; drives the calendar |
| `status` | enum | On Track / At Risk / Blocked / Wrapping (existing) |
| `phase` | enum | current focus phase (Discover…Deploy); drives timeline label |
| ★ `billing` | enum | `billable` \| `internal` (SSL side project) |
| ★ `opportunity` | `{ types[], note }` | the real thing we're driving toward (below) |
| ★ `contractValue` | number \| null | total $; shows "Internal / non-billable" when `billing = internal` |
| ★ `buildUrl` | string | first-class link to the thing we/they built → persistent "See the build ↗" button |
| ★ `team` → `assignments` | `{ name, role, load }[]` | upgraded from string[] (below) |
| `risks`, `needs`, `findings` | string[] | existing detail lists |
| `links` | `{ label, url }[]` | existing generic links (separate from `buildUrl`) |
| `entryPoint` | `{ mode, atStep }` | greenfield vs mid-build (see Layer 2) |
| `process` | map keyed by step id | the process instance (see Layer 2) |
| `updatedAt` | number | existing |

**`opportunity.types`** — multi-select from a fixed set (plus free-text `note`):
- `expansion` — more work from this client
- `referrals` — intros / referrals
- `cosell` — co-sell or partnership
- `ssl_ip` — building IP for SSL to market/sell

**`assignments[]`** — each person on the engagement:
- `name` — string
- `role` — string (e.g. "Eng", "Design", "PM")
- `load` — enum `lead` (heavy) \| `core` (medium) \| `light`

### Layer 2 — Process (the 5D, per client)

The canonical process is **fixed** (section 4). Each client holds a `process`
map keyed by **step id** (not array position), so the template can grow or be
renamed later without corrupting existing client data — unknown/new steps simply
render as "Not started."

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
| `validated` | ⊘✓ | client/prior work existed — we reviewed & validated it | what we checked / value added |
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
- Per client: overall % of *applicable* (non-`na`) steps that are done/validated.
- Per client: a **"Deliberately skipped / N-A — and why"** panel auto-built from
  `skipped` + `na` steps. This is the client-conversation artifact.

### Layer 3 — Resource view (cross-cutting)

A toggle that flips the board from "by client" to "by person." For each person
across all active clients: their assignments (client · role · load) and a rough
capacity read summed from `load` buckets, flagging anyone stacked across too many
heavy engagements. Read-only aggregation; editing still happens on the client.

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

Keep the current visual system (BRAND palette, Fraunces/Archivo, calendar,
opportunity pipeline). Additions:

**Header** — add a **view toggle: "By client" / "By resource."**

**Client card (collapsed)** — alongside name/status/phase-tracker, surface deal
signals: billing badge (Billable / Internal), contract value, an overall process
% , and the **"See the build ↗"** button when `buildUrl` is set.

**Client card (expanded)** — a new **Process** section is the centerpiece:
- 5 phase groups, each header showing its roll-up.
- Each step is a row: status icon · label · note · decisions count.
- **Inline click-to-set**: tapping a step opens a small control to pick status,
  edit the note, and add `what/why` decisions — no need to open the full editor
  for the 25 steps.
- The **"Deliberately skipped / N-A — and why"** panel.
- Existing Risks / Needs / Findings / Links remain.

**Client editor** — add deal-layer fields: billing, opportunity (multi-select +
note), contract value, build URL, and `assignments` (name · role · load).
Add the **entry point** picker (greenfield vs mid-build + step), which seeds
process defaults on save.

**Resource view** — grouped by person: each person's assignments (client · role ·
load dots) and an over/under-allocation flag.

**5D phase tracker** — the existing bar now reflects completion: a phase reads
"complete" when all its *applicable* steps are done/validated.

---

## 6. Data model & migration

State remains one JSON blob under a single storage key. **Bump the key** to
`ssl-standup-dashboard-v2` OR keep `v1` and normalize on load — decision: keep
the key and **normalize on load** so existing artifact data is preserved.

**`normalizeClient(c)`** runs on every load and makes any client whole:
- Back-fill missing deal fields with sane defaults (`billing: "billable"`,
  `opportunity: { types: [], note: "" }`, `contractValue: null`, `buildUrl: ""`).
- Convert legacy `team: string[]` → `assignments: [{ name, role: "", load: "core" }]`.
- Ensure `entryPoint` (default `{ mode: "greenfield", atStep: null }`).
- Build `process` from the template if absent. Inference from existing `phase`:
  steps in phases *before* the current phase → `done`; steps in the current
  phase → first `doing`, rest `todo`; later phases → `todo`. A sensible first
  guess the team corrects. Never drop unknown keys already present.

Because `process` is keyed by step id, editing the template later (add/rename/
reorder steps) is non-destructive.

---

## 7. v2 — AI context tailoring (designed-for, not built now)

**Input:** a per-client **Context** area — paste transcript/doc text + labeled
links. (Real file uploads are out of scope; they require the standalone backend.)

**Action:** send the pasted context + the canonical process to Claude and get
back a *proposed* instance: suggested `entryPoint`, per-step
skip/validate/add recommendations each with a drafted `why`, and any
industry-specific step additions. Rendered as **suggestions the human reviews,
edits, and accepts** — nothing auto-applied.

**Runtime:** prefer an in-artifact completion call (`window.claude.complete`) if
available at build time; **verify availability first.** Fallback with zero
dependency: generate a prompt the user copies into Claude and pastes the result
back. No backend either way.

---

## 8. Data-handling note

Client context is confidential — **contract values, sales-call transcripts, and
internal notes** live in `window.storage`, which is shared to anyone with the
artifact link. Minimize what's pasted (summaries over raw transcripts where
possible), treat the artifact link as sensitive, and don't fork copies. When the
standalone backend is built, revisit with proper access control and retention.

---

## 9. Open questions / assumptions

- **Assumed:** the 25-step process is correct as SSL's default (confirmed in
  brainstorming). Editable per client via skip/na; template edits are code changes.
- **Assumed:** `phase` stays an explicit field for the timeline; roll-ups are
  computed from `process`. Could later derive `phase` from the furthest active
  step — deferred.
- **To verify at build time:** whether `window.claude.complete` is live in
  Claude.ai artifacts (gates v2 runtime choice).
- **Deferred:** structured decisions vs. a single "notes & decisions" field —
  spec allows a `decisions[]` list; v1 may ship a lightweight version first.
