# DECISIONS.md — defaults chosen where the spec left room

| # | Decision point | Default chosen | Why |
|---|---|---|---|
| 1 | Mode | DEMO | credentials.md fully empty (Phase 0 rule 3). |
| 2 | Soft delete | Add `deletedAt DateTime?` to Item; all list queries filter `deletedAt: null` | Spec's DELETE route says "soft delete — set deletedAt" but schema lacked the column. |
| 3 | Gmail OAuth token storage (LIVE) | New `GoogleToken` table | Step 6 says "save refresh token to DB"; no table was specified. |
| 4 | Sale→item match on duplicate brand+model | Pick oldest IN_STOCK (FIFO), log ambiguity | Phase 1A question; FIFO is the intuitive inventory rule. |
| 5 | Currency conversion | Static map applied at creation, store `purchasePriceEur` | No live FX API available; freezing avoids historical drift. |
| 6 | Auth model | Single shared password (`DASHBOARD_PASSWORD`) + express-session cookie; no user table | Spec only mentions one password; single-operator app. |
| 7 | DEMO password | `demo1234` written to backend/.env when none provided | Lets the app be logged into with zero setup. |
| 8 | Frontend↔backend dev wiring | Vite proxy `/api` → `http://localhost:3001` | Avoids CORS in dev; one origin in prod (backend serves built frontend). |
| 9 | Claude model | `claude-haiku-4-5` (LIVE only) | Exact model named in CLAUDE.md Step 8. |
| 10 | Email alerts in DEMO | Log to console, do not send | No SMTP/OAuth creds in DEMO; never crash. |
| 11 | Currency map | `{ NGN: 0.00055, KES: 0.0069, EUR: 1.0, GBP: 1.17 }` | Exact values from CLAUDE.md Step 4. |
| 12 | netProfit formula | salePrice − purchasePriceEur − shippingCost − customsFees (missing → 0) | Spec says auto-calc on SOLD; this is the natural margin. |
