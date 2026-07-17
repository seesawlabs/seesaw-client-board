# SeeSaw Client Board

A SeeSaw Labs internal client-alignment board. It tracks active client
engagements against a 25-step "5D" process, with three layered views: a
deal layer, a process-instance layer, and a resource view.

This is a standalone Next.js (App Router) app deployed to Vercel, backed
by Neon Postgres via Drizzle ORM, and gated by Vercel deployment
protection (see [ADR 0003](docs/adr/0003-vercel-deployment-protection.md)
— there is no in-app auth in v1).

For the full product description, see [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md).
Key architecture decisions are recorded in [`docs/adr/`](docs/adr/):

- [0001 — Standalone Next.js on Vercel](docs/adr/0001-standalone-nextjs-vercel.md)
- [0002 — Neon Postgres + Drizzle](docs/adr/0002-neon-postgres-drizzle.md)
- [0003 — Vercel deployment protection](docs/adr/0003-vercel-deployment-protection.md)

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- Drizzle ORM + Neon Postgres
- Vitest

## Local setup

```bash
npm install
cp .env.example .env          # then set DATABASE_URL to your Neon connection string
npm run db:migrate            # apply the schema to your DB
npm run seed                  # load example clients + opportunity
npm run dev                   # http://localhost:3000
```

## Checks

```bash
npm test          # pure-logic unit tests
npm run check     # tsc --noEmit
npm run build     # production build
```

## AI Assistant

A chat panel lets you talk to the board instead of clicking through it.
Paste a message, a call transcript, or a public URL — the assistant infers
which client(s) you mean, then proposes and applies updates (phase/status
changes, notes, risks, new clients or opportunities) via the same validated
server actions the UI uses. Every change it makes lands in an **activity
feed** grouped by turn, each entry showing a before/after summary with a
per-entry **Undo** and a per-turn **Undo all**.

- **Route:** `app/api/assistant/route.ts` — a streaming `POST` handler built
  on the Vercel AI SDK v6 (`streamText` + tool-calling, capped at 12 steps
  per turn). The model is `anthropic/claude-sonnet-5`, called through the
  **Vercel AI Gateway**. Auth is via **Vercel OIDC** — no API key needed
  locally or in prod, just a valid `VERCEL_OIDC_TOKEN`.
- **Tool whitelist:** the agent can only call the tools defined in
  [`lib/assistant/tools.ts`](lib/assistant/tools.ts) (`queryBoard`,
  `upsertClient`, `setStep`, `upsertOpportunity`, `readLink`,
  `deleteClient`). Each mutating tool wraps an existing `lib/actions.ts`
  server action — the agent never touches the DB directly — and records a
  before-image so the change can be undone. Destructive actions (delete)
  require an explicit `confirmed: true` from the model after the user
  confirms.
- **Link ingestion:** paste a public URL and ask the assistant to use it;
  `readLink` (`lib/assistant/link.ts`) fetches and extracts readable text
  for the model to act on (e.g. add a finding).
- **Persistence:** two new tables — `activity` (one row per tool call:
  turn id, actor, tool, entity, before-image, undone flag) and `messages`
  (chat history, keyed by turn id) — back the feed and conversation replay.

## Deploy

Pushes to `main` auto-deploy to production via Vercel; pull requests get
preview deployments. Access is gated by **Vercel deployment protection**
(enable it under Project → Settings → Deployment Protection, for both
Production and Preview) rather than in-app auth — see
[ADR 0003](docs/adr/0003-vercel-deployment-protection.md).

## Note

The root `dashboard.jsx` is the retired Claude.ai artifact prototype.
It's kept only as a UI-markup reference and is not part of the app.
