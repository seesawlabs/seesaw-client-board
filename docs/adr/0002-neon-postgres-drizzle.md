# ADR 0002 — Neon Postgres + Drizzle for persistence

**Status:** Accepted · 2026-07-16

## Context

Replacing `window.storage` (a single JSON blob) with real persistence for a
small internal team that edits a shared board. Data shape: a handful of clients,
each with nested process/assignments/lists, plus an opportunity pipeline. Low
volume, occasional concurrent edits.

## Decision

Use **Neon Postgres** (provisioned via the Vercel Marketplace) with **Drizzle
ORM** for a typed schema and migrations. Store the nested per-client structures
(`process` map, `assignments`, `opportunity`, and the risks/needs/findings/links
lists) as **JSONB columns** on a `clients` table; a separate `opportunities`
table for the pipeline.

## Alternatives considered

- **Supabase** — bundles storage + auth, tempting for v2 uploads/login, but
  we've chosen Vercel deployment protection for auth (ADR 0003) and can add Blob
  storage later; a second platform isn't worth it now.
- **SQLite/Turso** — fine for single-writer, weaker story for a shared
  multi-editor internal tool and off the main Vercel path.
- **Fully-normalized relational schema** (separate `assignments`, `steps`
  tables) — cleaner in theory, but the whole client is edited as one form and
  the pure logic already operates on the nested shape. JSONB keeps the port
  verbatim and the ORM friction near zero. Revisit if we need cross-client
  queries (e.g. a canonical `people` table for the resource view).

## Consequences

- Pure logic (`normalizeClient`, roll-ups, `resourceRows`) ports unchanged —
  it already operates on the nested JSON shape.
- Resource-view aggregation happens in app code over the fetched clients, not in
  SQL. Fine at this scale.
- `process` stays keyed by step id in JSONB → template can evolve
  non-destructively, same property we designed for the artifact.
