# Vinted Brand Dashboard

A mobile-first dashboard for a luxury secondhand bag reseller. Tracks inventory
through four lifecycle stages (**Sourced → In Transit → In Stock → Sold**), with
automated Vinted sale detection (Gmail), expense tracking (Wise), and AI insights
(Claude). Built to run fully in **DEMO mode** with zero credentials, then flip to
**LIVE** when you're ready.

## Stack
- **Backend:** Node + Express + TypeScript, Prisma ORM
- **Frontend:** React + TypeScript + Tailwind + Vite
- **DB:** SQLite (DEMO) / PostgreSQL via Supabase (LIVE)
- **Integrations:** Gmail OAuth, Wise API, Anthropic Claude (`claude-haiku-4-5`)

## Quick start (DEMO mode — no credentials needed)

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env            # defaults are DEMO-ready (password: demo1234)
npx prisma migrate dev --name init
npm run seed                    # 10 demo items + 3 runners
npm run dev                     # API on http://localhost:3001

# 2. Frontend (in a second terminal)
cd frontend
npm install
npm run dev                     # UI on http://localhost:5173
```

Open http://localhost:5173 and log in with **demo1234**.

## Modes
- **DEMO** (default): every external call (Gmail, Wise, Claude, email) is replaced
  with realistic mock data. SQLite database. The whole app is testable end-to-end.
- **LIVE**: real APIs. Set `APP_MODE=LIVE` and fill credentials. See
  [`DEPLOYMENT.md`](./DEPLOYMENT.md).

## Project layout
```
/backend    Express API, Prisma schema, services (gmail, wise, ai, alerts), jobs
/frontend   React SPA — pages, components, hooks, typed API client
PLAN.md     Architecture, data model, API table, risk register
DECISIONS.md  Default decisions made where the spec left room
DEPLOYMENT.md Non-developer guide to going live on Railway + Supabase
```

## Key scripts
| Where | Command | Does |
|---|---|---|
| backend | `npm run dev` | Start API with hot reload |
| backend | `npm run seed` | Reset DB to demo data |
| backend | `npm run prisma:studio` | Browse the database |
| backend | `npm run build` | Generate client, build frontend, compile API (prod) |
| frontend | `npm run dev` | Start Vite dev server (proxies `/api`) |
| frontend | `npm run build` | Production bundle |

## Health check
`GET /api/health` → `{ "status": "ok", "mode": "DEMO"|"LIVE", "timestamp": "..." }`
