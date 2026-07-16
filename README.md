# SSL Standup Dashboard

A shared, editable team standup board for SeeSaw Labs — active client
engagements, a portfolio-level calendar view, and a pipeline of potential
new opportunities. Built as a single-file React component that runs as a
**Claude.ai artifact**.

## How this actually runs

This is not a deployed web app — it runs inside Claude.ai using the
artifact feature. Data is stored via `window.storage`, an API that only
exists inside Claude.ai artifacts (it's how the "shared, editable by the
whole company" part works, with no backend to host or pay for).

That means:

- This repo is for **version control and code review** — proposing
  changes, tracking history, discussing pull requests.
- To actually *use* a change, someone pastes the updated `dashboard.jsx`
  into a Claude.ai artifact (see below). Running the raw file with
  `npm run dev` locally will error on `window.storage` — that's expected,
  it doesn't exist outside Claude.ai.
- All data lives in Claude's shared artifact storage, scoped to that one
  artifact/link. Losing the artifact link means losing the data, so treat
  that link as the source of truth and don't create duplicate copies of
  the dashboard for different teams.

## Making a change

1. Clone the repo, branch, edit `dashboard.jsx`.
2. Open a PR as normal so the team can review.
3. Once merged, whoever owns the live artifact link pastes the new
   `dashboard.jsx` contents into Claude (ask Claude to "update the artifact
   with this code") to publish the change. The existing stored data isn't
   affected by a code update — same storage key, new component code.
4. Tag the release loosely by date in the PR title (e.g. "2026-07-16:
   add engagement calendar") since there's no build/deploy pipeline to
   version this against.

## File

- `dashboard.jsx` — the entire dashboard (data model, editors, calendar,
  styling). Single file by design, matching how Claude.ai artifacts work.

## Local sanity-checking (optional)

You can syntax-check the file without `window.storage` calls actually
succeeding:

```bash
npx --yes esbuild dashboard.jsx --loader:.jsx=jsx --jsx=automatic --bundle --external:react --outfile=/dev/null
```

This catches typos and JSX errors before you paste into Claude, but it
won't render the UI or exercise storage — that only happens inside the
artifact.

## Wanting a "real" deployed version later

If this ever needs to run outside Claude.ai (its own URL, no Claude
session required), the storage layer needs to be swapped for a real
backend (e.g. Supabase, Firebase, or a small API + Postgres) and the app
needs a build setup (Vite, etc.). That's a bigger lift and a different
conversation — worth having once the team has used this version long
enough to know what they'd actually want from a standalone tool.
