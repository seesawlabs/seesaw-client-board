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

## Deploy

Pushes to `main` auto-deploy to production via Vercel; pull requests get
preview deployments. Access is gated by **Vercel deployment protection**
(enable it under Project → Settings → Deployment Protection, for both
Production and Preview) rather than in-app auth — see
[ADR 0003](docs/adr/0003-vercel-deployment-protection.md).

## Note

The root `dashboard.jsx` is the retired Claude.ai artifact prototype.
It's kept only as a UI-markup reference and is not part of the app.
