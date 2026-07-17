# ADR 0004 — AI assistant: tool-calling agent that auto-applies over server actions

**Status:** Accepted · 2026-07-17

## Context

The board's risk is upkeep: a form-filling tool becomes management overhead and
gets abandoned. We want to make board state, decisions, and docs a *byproduct*
of natural work — chat, paste a transcript, drop a link — and have the tool
apply the updates itself. Spec §7 (v2 AI Assistant) captures the full design.

Two shaping decisions came out of brainstorming:
- **Autonomy:** auto-apply changes (with a reversible activity log + undo) rather
  than propose-and-approve — lowest friction, which is the whole point.
- **Surface:** one global assistant that *infers* the client, not per-client chat.

## Decision

Build a **tool-calling agent** (Vercel AI SDK, via the AI Gateway; default
`anthropic/claude-sonnet-<latest>`) whose only capabilities are a **whitelisted
set of tools that wrap the existing server actions** (`upsertClient`, `saveStep`,
`upsertOpportunity`, `deleteClient`, plus read `queryBoard`). The agent
**auto-applies** changes; every mutation is written to a new **`activity` table**
with a before-image, giving a full audit trail and **one-click undo** (restore
before-image / delete created row; "undo all" per turn). Destructive ops confirm.
Ingestion is phased: text/paste-transcript/paste-link first, then file upload
(Blob + parse), then doc generation, then proactive nudges.

## Alternatives considered

- **Propose → approve (copilot).** Safer, builds trust, but a click per update —
  more overhead, working against the goal. Rejected as the default; the activity
  log + undo gives the same safety without the friction.
- **Per-client chat threads.** No client-inference ambiguity, but you navigate
  first and cross-cutting questions ("who's overloaded?") don't fit. Rejected as
  primary; may add later.
- **Agent with direct DB / raw SQL access.** Maximum flexibility, unacceptable
  blast radius and no validation. Rejected — tools wrap the validated actions.
- **A separate agent service.** Unnecessary; the AI SDK route lives in the same
  Next app next to the actions it calls.

## Consequences

- Reuses the entire validated mutation surface; the agent can't do anything a
  user couldn't do through the actions.
- Requires new persistence: `activity` (audit + undo) and `messages` (thread).
- Auto-apply is only safe because undo is real — the before-image/undo path is
  load-bearing and must be tested (apply → undo → equals before).
- Client-confidential content flows to the LLM — route via AI Gateway with
  zero-data-retention; don't log raw content (see spec §8).
- Cost/loops bounded by a per-turn tool-call cap; model is swappable.
- Deployment protection (ADR 0003) still gates the whole app, assistant included.
