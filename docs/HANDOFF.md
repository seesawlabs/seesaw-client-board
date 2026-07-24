# Handoff — current state (2026-07-24)

A portable snapshot so this can be picked up in a fresh session / different
account. Code is the source of truth; secrets live in Vercel env (never in git).

## What's live

The board has grown from a status tracker into an **ambient morning-briefing
console**: it ingests real signal from four sources, synthesizes a per-project
brief nightly, and reads at two altitudes (scroll-to-scan for execs; dig-in to
run a daily standup).

| Area | Status |
|---|---|
| Standups (Google Meet notes in Drive) ingestion | ✅ live |
| Project docs ingestion (SOW/spec/PDF via `pdf-parse`) | ✅ live |
| Slack ingestion (per-project channels + global SeeSaw standup) | ✅ live |
| GitHub ingestion (PRs + issues → step/needs/risks) | ✅ live & tested |
| Nightly cron → synthesized brief | ✅ live (`/api/cron/brief`, 11:00 UTC) |
| Brief: lede + "⏱ Due soon" (dated deadlines only); prose on each card | ✅ live |
| Google auth `@seesawlabs.com` | 🟡 **built, deployed dormant** (see rollout) |

- **Sources model = 3 tiers** behind one unit abstraction (`lib/assistant/sources.ts`):
  global (SeeSaw internal standups → all projects), account (a client's shared
  folder/channels), project (its own — overrides account). Per-project sources
  set via each card's **Sources** control.
- **Phase is derived** from step progress (`derivePhase` in `lib/process.ts`) —
  never manually set.
- **All agent mutations are atomic** (`saveStep`/`appendListItem` do row-locked
  JSONB merges) — fixes a parallel-tool-call lost-write bug. Never edit the DB
  from the agent path directly; go through `lib/actions.ts` via `tools.ts`.
- `ai` package pinned to **v6** — do not upgrade to v7.

## Ingestion / synthesis map

- `lib/{google,slack,github}.ts` — read-only source clients.
- `lib/assistant/{ingest,context-ingest,slack-ingest,github-ingest}.ts` — per-source agents.
- `lib/assistant/synthesize.ts` — per project → `{prose, deadlineDate, deadlineLabel}` (generateObject).
- Brief fields on `clients`: `brief_prose`, `brief_deadline`, `brief_deadline_label`, `brief_at`.
- Manual triggers: "Sync …" pills in the Sources strip; "↻ Regenerate" in the brief.

## Environment (names only — values in Vercel prod + local `.env`)

`DATABASE_URL` · `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (OAuth, reused for
auth) · `SLACK_BOT_TOKEN` · `GITHUB_TOKEN` (classic PAT, repo scope) ·
`CRON_SECRET` · `AUTH_SECRET` · `AUTH_ENFORCED` (unset = auth gate dormant).
AI Gateway uses Vercel **OIDC** (no Anthropic key). Recover values on a new
machine with `vercel env pull`.

## ACTIVE THREAD — auth rollout (do in order; Vercel SSO stays on until last)

Google sign-in via Auth.js v5, restricted to `@seesawlabs.com`; one shared
board, no roles. Code is deployed but **dormant** (`AUTH_ENFORCED` unset →
middleware allows all; Vercel SSO still gates). Stable prod URL:
`seesaw-client-board-see-saw-labs.vercel.app`. Target domain: `board.seesawlabs.com`.

1. **GCP** — on OAuth client `154209248372-se97eo…`, add Authorized redirect URIs:
   `https://board.seesawlabs.com/api/auth/callback/google`,
   `https://seesaw-client-board-see-saw-labs.vercel.app/api/auth/callback/google`,
   `http://localhost:3000/api/auth/callback/google`.
2. **Test** login at `…vercel.app/login` (reachable past Vercel SSO).
3. **Domain** — add `board.seesawlabs.com` in Vercel → teammate adds DNS CNAME
   (`board` → `cname.vercel-dns.com` or whatever Vercel shows).
4. **Enforce** — set `AUTH_ENFORCED=true` in Vercel prod, redeploy.
5. **Remove Vercel SSO** — Settings → Deployment Protection → off. Now the
   whole company reaches `board.seesawlabs.com` via Google login.

Auth files: `auth.ts`, `middleware.ts`, `app/api/auth/[...nextauth]/route.ts`,
`app/login/page.tsx`, `components/UserMenu.tsx`.

## Deferred (no rush)

- State Agency's GitHub repo — one field in its project **Sources** once known.
- **Drizzle migration journal is behind** the DB (the `brief_attention` →
  `brief_deadline`/`brief_deadline_label` change was applied via direct SQL).
  Deploys don't auto-migrate, so nothing's broken; reconcile with
  `drizzle-kit push` (or a hand-authored migration) on the next schema change.
- Header still reads "Standup board" (intentional, keep for now).
- Multi-tracker (Trello/JIRA) — the source-tier architecture generalizes; later.
