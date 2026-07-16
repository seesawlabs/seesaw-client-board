# AGENTS.md

**Product spec (source of truth):** [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)

## What this is

A shared SeeSaw Labs client-alignment board that runs as a **single-file
Claude.ai artifact** (`dashboard.jsx`) backed by `window.storage`. Not a
deployed app — see `README.md` for how changes get published (paste into the
live artifact). No backend, no build/deploy pipeline.

## Working here

- **Read `docs/PRODUCT_SPEC.md` before making changes.** It defines the
  three-layer model (deal / 5D process / resource view), the canonical 25-step
  process, the data model, and the v2 AI direction.
- All app code lives in `dashboard.jsx` (single file, by design).
- Sanity-check syntax without a real artifact:
  `npx --yes esbuild dashboard.jsx --loader:.jsx=jsx --jsx=automatic --bundle --external:react --outfile=/dev/null`
- Data is confidential (contract values, client context in shared storage) —
  see the data-handling note in the spec.
