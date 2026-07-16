# ADR 0003 — Vercel deployment protection for access control (v1)

**Status:** Accepted · 2026-07-16

## Context

The board holds confidential data: contract values, client notes, and (in v2)
pasted sales-call context. It must not be publicly reachable. But it is a
**shared team board** with no per-user features in v1 — functionally it's "the
whole SSL team edits the same board," exactly like the artifact was "whoever has
the link." We don't yet need individual accounts, per-user views, or an audit
trail.

## Decision

Gate the entire deployment behind **Vercel deployment protection** (team /
password protection at the platform level). No authentication code in the app
for v1.

## Alternatives considered

- **Clerk per-user login** (Google, team-email allowlist) — real accounts, the
  right call *if/when* we add per-user features ("my projects", audit). Over-built
  for a shared board today; defer to when a per-user feature actually needs it.
- **Shared in-app password** — self-contained, but re-implements coarse auth we
  get for free from the platform, and we'd own the session handling.

## Consequences

- Zero auth code; fastest path to a protected live URL.
- Access is all-or-nothing (no per-user identity). The resource view's "people"
  are data, not logged-in users — unaffected.
- **Upgrade trigger:** the first genuine per-user requirement (personal views,
  who-changed-what) promotes us to Clerk (revisit this ADR then).
- Assignment names are free-text until a per-user/people model exists — accept
  minor typo risk in the resource view for now.
