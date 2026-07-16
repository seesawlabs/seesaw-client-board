# ADR 0001 — Standalone Next.js app on Vercel

**Status:** Accepted · 2026-07-16

## Context

The board began as a single-file React component running as a **Claude.ai
artifact** backed by `window.storage`. That model made it free to host and
"shared by whoever has the link," but it blocked: real persistence, file
uploads (needed for the planned AI context-tailoring), a stable URL, and any
access control. We decided to roll it out of Claude.ai into a standalone app.

## Decision

Build the standalone board as a **Next.js (App Router) application deployed on
Vercel.** React UI (our existing components port over), backend via server
actions / route handlers, git-push auto-deploys.

## Alternatives considered

- **Vite SPA + separate API** — more moving parts (two deploys, CORS, separate
  hosting) for no benefit at this scale.
- **Remix / TanStack Start** — capable, but less aligned with this
  Vercel-centric environment and the team's existing Next+Vercel experience
  (Megamine).

## Consequences

- One framework, one deploy target, typed end-to-end (TypeScript).
- Components move from one artifact file to a normal `components/` tree.
- "Publish" changes from paste-into-artifact to `git push` (preview + prod).
- Ties us to Vercel conventions; acceptable given the rest of SSL's stack.
