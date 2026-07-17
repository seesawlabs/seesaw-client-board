# AGENTS.md

**Product spec (source of truth):** [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)
**Architecture decisions:** [`docs/adr/`](docs/adr/)

## What this is

A shared SeeSaw Labs client-alignment board — a **Next.js (App Router) app on
Vercel**, backed by **Neon Postgres** (Drizzle ORM), gated by **Vercel
deployment protection**. It tracks each client engagement against SSL's canonical
5D process (see spec §3–4).

> Note: `dashboard.jsx` at the repo root is the **original Claude.ai artifact
> prototype**, kept for reference. The standalone app supersedes it — see the
> implementation plan in `docs/superpowers/plans/`.

## Working here

- **Read `docs/PRODUCT_SPEC.md` and the ADRs before making changes.**
- Pure logic (process template, normalize, roll-ups, allocation) lives in
  `lib/process.ts` and is unit-tested (`npm test`, vitest) — no DB needed.
- DB schema in `lib/db/schema.ts`; server actions in `lib/actions.ts`.
- `npm run dev` for local; `npm run check`/`npm run build` before pushing.
- Data is confidential (contract values, client context) — see spec §8.
- **AI assistant** lives in `lib/assistant/`: `tools.ts` is the agent's
  **only** whitelisted mutation surface (it wraps `lib/actions.ts` — never
  edit the DB from the agent path directly); `activity.ts` records
  before-images and drives undo; `resolve.ts`/`context.ts` handle client
  inference and system-prompt/board context; `link.ts` fetches
  user-pasted URLs. The route is `app/api/assistant/route.ts`. The `ai`
  package is pinned to **v6** (`^6.0.230`) — do not upgrade to v7 without
  a deliberate migration; APIs differ.
