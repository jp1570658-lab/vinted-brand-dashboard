# PLAN.md — Vinted Brand Dashboard

> Mode: **DEMO** (credentials.md is empty → all external APIs mocked, SQLite DB).
> This plan is the single source of truth for the build. Steps 2–11 follow it.

---

## 1. FOLDER STRUCTURE

```
/backend
  /src
    /routes         — items.ts, runners.ts, transactions.ts, ai.ts, sync.ts, auth.ts, health.ts
    /middleware     — auth.ts, errorHandler.ts, upload.ts, validate.ts
    /services       — gmail.ts, wise.ts, ai.ts, currency.ts, mode.ts
    /jobs           — gmailPoller.ts, wisePoller.ts, agingChecker.ts
    /lib            — prisma.ts (client singleton), stats.ts, levenshtein.ts
    /prisma         — schema.prisma, seed.ts
    app.ts          — express app wiring
    server.ts       — entrypoint, starts jobs
  /uploads          — uploaded photos (gitignored)
  .env / .env.example
  package.json / tsconfig.json / .eslintrc.cjs / .prettierrc

/frontend
  /src
    /components     — ItemCard, KPICard, QuickIntakeModal, AgingBadge, StatusBadge,
                      AlertBanner, FloatingAddButton, Skeleton, EmptyState, TopNav
    /pages          — Login, Dashboard, FutureStock, InTransit, InStock, Sold,
                      Transactions, Settings
    /hooks          — useItems, useStats, useAI, useAuth
    /api            — client.ts + typed wrappers per route
    /lib            — format.ts (currency/date), status.ts
    App.tsx, main.tsx, index.css
  vite.config.ts / tailwind.config.ts / postcss.config.js
  package.json / tsconfig.json

/  PLAN.md  DECISIONS.md  CLAUDE.md  credentials.md  railway.toml  DEPLOYMENT.md  .gitignore
```

---

## 2. DATABASE SCHEMA

Per CLAUDE.md spec (Item, Runner, WiseTransaction, GmailSync). DEMO uses SQLite.
Additions for spec compliance: `deletedAt DateTime?` on Item (soft delete, Step 4),
indexes (Step 10), `GoogleToken` table to persist Gmail OAuth refresh token (LIVE, Step 6).

| Model | Key fields |
|---|---|
| **Item** | id, brand, model, grade?, color?, photoUrl?, status(enum), sourcedAt, transitAt?, stockAt?, soldAt?, purchasePrice, purchaseCurrency, purchasePriceEur?, shippingCost?, customsFees?, listedPrice?, salePrice?, netProfit?, notes?, vintedOrderId?, saleSource?, runnerId?→Runner, wiseTransactions[], deletedAt?, createdAt, updatedAt |
| **Runner** | id, name, location, contact?, items[], createdAt |
| **WiseTransaction** | id, wiseId(unique), date, amount, currency, amountEur?, description, category?, itemId?→Item, createdAt |
| **GmailSync** | id, lastSyncAt, emailCount, salesFound |
| **GoogleToken** (LIVE) | id, refreshToken, accessToken?, expiry?, createdAt, updatedAt |

`enum ItemStatus { SOURCED IN_TRANSIT IN_STOCK SOLD }`

---

## 3. API ROUTES TABLE

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | /api/auth/login | password login → session | no |
| POST | /api/auth/logout | destroy session | yes |
| GET | /api/auth/me | current session state | no |
| GET | /api/items | list, filters: status, runnerId, from, to, page, limit | yes |
| POST | /api/items | create (multipart, photo) | yes |
| GET | /api/items/stats | KPI aggregates | yes |
| GET | /api/items/:id | one item + relations | yes |
| PATCH | /api/items/:id | update / status transition (+netProfit) | yes |
| DELETE | /api/items/:id | soft delete (deletedAt) | yes |
| GET | /api/runners | list runners | yes |
| POST | /api/runners | create runner | yes |
| PATCH | /api/runners/:id | update runner | yes |
| GET | /api/transactions | list, filters + pagination | yes |
| PATCH | /api/transactions/:id | edit / link to item / category | yes |
| GET | /api/sync/gmail | manual Gmail sync | yes |
| GET | /api/sync/wise | manual Wise sync | yes |
| GET | /api/ai/forecast | revenue forecast | yes |
| GET | /api/ai/pricing/:itemId | time-to-sell + price | yes |
| GET | /api/ai/sourcing | runner ROI ranking | yes |
| GET | /api/health | { status, mode, timestamp } | no |

---

## 4. INTEGRATION MAP

- **Gmail (LIVE):** OAuth2 (`google-auth-library` + `googleapis`). Scopes: `gmail.readonly`, `gmail.send`. Routes `/api/auth/google` + `/callback`; refresh token → `GoogleToken`. Poller every 10 min: query `from:(noreply@vinted.fr OR noreply@vinted.com)`, parse "Vous avez vendu"/"You've sold", regex price `/€\s*([\d.,]+)/`, match IN_STOCK by Levenshtein ≥0.7 (FIFO on ties), set SOLD + `saleSource=AUTO_GMAIL`, else log `unmatched_sales.log`. Write `GmailSync`.
- **Wise (LIVE):** Bearer `WISE_API_KEY`. `GET /v1/profiles` → profile id; poller every 6h `GET /v3/profiles/{id}/transfers?status=outgoing_payment_sent`; dedup `wiseId`; auto-categorize (DHL/UPS/Colissimo→SHIPPING, runner name→RUNNER_PAYMENT, >€200+"transfer"→STOCK_PURCHASE, else OTHER).
- **Claude (LIVE):** `@anthropic-ai/sdk`, model `claude-haiku-4-5`. Three prompts (time-to-sell, sourcing ROI, forecast) per CLAUDE.md. JSON-only responses parsed defensively; empty-DB fallback message.

---

## 5. DEMO MODE DATA MAP

| Real call | DEMO replacement |
|---|---|
| Database (Supabase PG) | SQLite file `backend/prisma/dev.db` |
| Gmail sync | Hardcoded parsed sale → marks oldest IN_STOCK item SOLD |
| Wise sync | Hardcoded list of 5 transactions (shipping, runner pay, stock purchase, etc.) |
| Claude forecast | Hardcoded forecast JSON |
| Claude pricing | Hardcoded { daysToSell, recommendedPrice, confidence, reasoning } |
| Claude sourcing | Hardcoded runner ROI array + priorityThisWeek |
| Email alerts (Nodemailer) | Logged to console instead of sent |

Mode is read once from `APP_MODE` env (default DEMO) in `services/mode.ts`.

---

## 6. BUILD ORDER

| Step | Depends on |
|---|---|
| 2 Scaffold & env | — |
| 3 DB schema & migrations | 2 |
| 4 Backend API CRUD | 3 |
| 5 Frontend dashboard | 4 |
| 6 Gmail (mock) | 4 |
| 7 Wise (mock) | 4 |
| 8 AI features (mock) | 4 |
| 9 Alerts | 4,5 |
| 10 Polish/perf/security | 4–9 |
| 11 Deployment config | all |

---

## 7. RISK REGISTER

| Risk | Likelihood | Mitigation | Fallback |
|---|---|---|---|
| Gmail parsing breaks on format change | High (LIVE) | Regex + similarity threshold, isolated service | unmatched_sales.log, manual mark-sold |
| Wise API shape/limits | Med (LIVE) | 6h poll, dedup, defensive parsing | manual transaction entry |
| Claude returns non-JSON | Med (LIVE) | Strict JSON parse + try/catch | graceful fallback message |
| 500+ items slow UI | Med | indexes + pagination + lazy img | server-side filtering |
| Sale matches wrong item (dupes) | Med | FIFO oldest + ambiguity log | manual relink |
| Secrets leaked to git | Low | .gitignore .env/credentials.md, verified in Step 10 | rotate keys |
| Currency drift | Low | freeze purchasePriceEur at creation | re-run conversion on demand |
```