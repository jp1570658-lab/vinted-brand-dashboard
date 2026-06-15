# CLAUDE.md — Vinted Brand Dashboard: Full Build Instructions

## ⚠️ READ THIS ENTIRE FILE BEFORE WRITING A SINGLE LINE OF CODE

---

## 🧠 CONTEXT TRACKING (Required throughout the entire build)

At the start of every response, print this header block and keep it updated:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 BUILD PROGRESS
   Current Step  : [e.g. Step 3 — Database Schema]
   Steps Done    : 2 / 11
   Last Commit   : step-2: project scaffold and environment
   Mode          : DEMO (no real credentials) | LIVE (real credentials)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Update this block every time you complete a step or switch modes.

---

## PHASE 0 — READ & UNDERSTAND

Before doing anything else:

1. Read this entire `CLAUDE.md` file from top to bottom
2. Read `credentials.md` — note which fields are filled vs empty
3. If `credentials.md` has empty fields → automatically set `MODE = DEMO`
4. If all required fields are filled → set `MODE = LIVE`
5. Print a summary of what you understood from both files before proceeding

**DEMO MODE rules:**
- Replace all real API calls with mock data that looks realistic
- Gmail sync → return a hardcoded fake sale notification
- Wise API → return a hardcoded list of fake transactions
- Claude AI → return a hardcoded forecast JSON
- Database → use SQLite locally instead of Supabase PostgreSQL
- The full UI must be testable end-to-end with zero real credentials

**LIVE MODE rules:**
- Use all real APIs from `credentials.md`
- Load every secret via `process.env` — never hardcode
- Confirm each integration works before committing

---

## PHASE 1 — DETAILED PLANNING

**Do not write any application code until this phase is fully complete.**

### 1A — Think Out Loud First

Before writing `PLAN.md`, reason through the following and print your conclusions:

- What is the simplest possible data model that covers all four statuses?
- What are the riskiest parts of this build? (Vinted scraping, Gmail OAuth, Wise API rate limits)
- What breaks first if we have 500 items in the database?
- What is the mobile UX flow for the Quick Intake — what is the fewest number of taps?
- How do we handle currency conversion without a live FX API?
- How do we match a Gmail sale notification to the correct item in the database?
- What happens if two items have the same brand and model?

### 1B — Write PLAN.md

Create `PLAN.md` in the project root. It must contain:

```
1. FOLDER STRUCTURE
   /backend
     /src
       /routes         — one file per resource (items, runners, transactions, ai, sync, auth)
       /middleware     — auth, error handler, upload
       /services       — gmail.ts, wise.ts, ai.ts, currency.ts
       /jobs           — gmailPoller.ts, wisePoller.ts, agingChecker.ts
       /prisma         — schema.prisma
     .env
     package.json
     tsconfig.json

   /frontend
     /src
       /components     — ItemCard, KPICard, QuickIntakeModal, AgingBadge, StatusBadge
       /pages          — Login, Dashboard, FutureStock, InTransit, InStock, Sold, Transactions, Settings
       /hooks          — useItems, useStats, useAI
       /api            — typed fetch wrappers for every backend route
     vite.config.ts
     tailwind.config.ts
     package.json

2. DATABASE SCHEMA          (every table, column, type, relationship)
3. API ROUTES TABLE         (method | path | description | auth required)
4. INTEGRATION MAP          (Gmail OAuth steps, Wise API endpoints used, Claude prompt templates)
5. DEMO MODE DATA MAP       (what mock data replaces each real API call)
6. BUILD ORDER              (Steps 2–11 with dependencies between steps)
7. RISK REGISTER            (risk | likelihood | mitigation | fallback)
```

### 1C — Validation Before Moving On

- Re-read `PLAN.md` and confirm it answers every question from Phase 1A
- If anything is unclear, document the decision in `DECISIONS.md` and state your default
- Only proceed to Phase 2 after printing: ✅ PLAN.md is complete and validated

---

## PHASE 2 — STEP-BY-STEP BUILD

Each step follows this exact pattern:

```
1. ANNOUNCE the step — print what you are about to build
2. BUILD — write the code
3. BUG CHECK — run the verification checklist for that step
4. FIX — resolve any issues found before moving on
5. COMMIT — git add + git commit with the exact message shown
6. ANNOUNCE NEXT — print what comes next
```

---

### STEP 2 — PROJECT SCAFFOLD & ENVIRONMENT

**Build:**
- Monorepo with `/backend` (Node.js + Express + TypeScript) and `/frontend` (React + TypeScript + Tailwind + Vite)
- ESLint + Prettier configured for both
- `.gitignore` — must exclude: `.env`, `credentials.md`, `node_modules`, `dist`, `uploads/`
- `.env.example` with every variable listed below and a comment on each
- `git init` + initial commit

**.env.example:**
```
# PostgreSQL connection (Supabase in LIVE mode, SQLite path in DEMO mode)
DATABASE_URL=

# Google OAuth (for Gmail integration)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback

# Wise API
WISE_API_KEY=
WISE_PROFILE_ID=

# Anthropic Claude API
ANTHROPIC_API_KEY=

# App security
SESSION_SECRET=
DASHBOARD_PASSWORD=

# Server
PORT=3001
NODE_ENV=development

# Build mode: DEMO or LIVE
APP_MODE=DEMO
```

**🐛 Bug Check:**
- [ ] `npm install` in `/backend` — zero errors
- [ ] `npm install` in `/frontend` — zero errors  
- [ ] `npm run dev` in `/backend` — server starts on PORT 3001
- [ ] `npm run dev` in `/frontend` — Vite starts on PORT 5173
- [ ] `.gitignore` confirmed — run `git status` and confirm `.env` does NOT appear
- [ ] TypeScript compiles without errors in both folders (`npx tsc --noEmit`)

**Git:** `git add . && git commit -m "step-2: project scaffold and environment"`

---

### STEP 3 — DATABASE SCHEMA & MIGRATIONS

**DEMO MODE:** Use SQLite with Prisma (`datasource db { provider = "sqlite" }`)
**LIVE MODE:** Use PostgreSQL via Supabase (`datasource db { provider = "postgresql" }`)

**Schema — `/backend/prisma/schema.prisma`:**

```prisma
model Item {
  id               String    @id @default(uuid())
  brand            String
  model            String
  grade            String?
  color            String?
  photoUrl         String?
  status           ItemStatus @default(SOURCED)
  sourcedAt        DateTime   @default(now())
  transitAt        DateTime?
  stockAt          DateTime?
  soldAt           DateTime?
  purchasePrice    Float
  purchaseCurrency String     @default("EUR")
  purchasePriceEur Float?
  shippingCost     Float?
  customsFees      Float?
  listedPrice      Float?
  salePrice        Float?
  netProfit        Float?
  notes            String?
  vintedOrderId    String?
  saleSource       String?    // "AUTO_GMAIL" | "MANUAL"
  runnerId         String?
  runner           Runner?    @relation(fields: [runnerId], references: [id])
  wiseTransactions WiseTransaction[]
  createdAt        DateTime   @default(now())
  updatedAt        DateTime   @updatedAt
}

enum ItemStatus {
  SOURCED
  IN_TRANSIT
  IN_STOCK
  SOLD
}

model Runner {
  id        String   @id @default(uuid())
  name      String
  location  String
  contact   String?
  items     Item[]
  createdAt DateTime @default(now())
}

model WiseTransaction {
  id          String   @id @default(uuid())
  wiseId      String   @unique
  date        DateTime
  amount      Float
  currency    String
  amountEur   Float?
  description String
  category    String?
  itemId      String?
  item        Item?    @relation(fields: [itemId], references: [id])
  createdAt   DateTime @default(now())
}

model GmailSync {
  id         String   @id @default(uuid())
  lastSyncAt DateTime
  emailCount Int
  salesFound Int
}
```

**🐛 Bug Check:**
- [ ] `npx prisma migrate dev --name init` completes with no errors
- [ ] `npx prisma studio` opens and shows all 4 tables
- [ ] Seed the DB with 3 demo items (one per status) and confirm they appear in Prisma Studio
- [ ] Run `npx prisma validate` — no schema errors

**Git:** `git add . && git commit -m "step-3: database schema and prisma migrations"`

---

### STEP 4 — BACKEND API (CORE CRUD)

**Build all REST routes:**

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/items                  ?status= &runnerId= &from= &to= &page= &limit=
POST   /api/items                  (multipart/form-data for photo upload)
GET    /api/items/stats
GET    /api/items/:id
PATCH  /api/items/:id
DELETE /api/items/:id              (soft delete — set deletedAt)
GET    /api/runners
POST   /api/runners
PATCH  /api/runners/:id
GET    /api/transactions
PATCH  /api/transactions/:id
GET    /api/sync/gmail             (manual trigger)
GET    /api/sync/wise              (manual trigger)
GET    /api/ai/forecast
GET    /api/ai/pricing/:itemId
GET    /api/ai/sourcing
GET    /api/health                 (returns { status: "ok", mode: APP_MODE, timestamp })
```

**Middleware stack (in order):**
1. `helmet()` — security headers
2. `compression()` — gzip responses
3. `express-rate-limit` — 100 req / 15 min per IP
4. `express-session` — cookie-based sessions
5. `authMiddleware` — 401 on all `/api/*` except `/api/auth/login` and `/api/health`
6. `errorHandler` — catch-all, return `{ error: message, stack: (dev only) }`

**Business logic:**
- Currency conversion map: `{ NGN: 0.00055, KES: 0.0069, EUR: 1.0, GBP: 1.17 }` — apply on item creation
- On `PATCH /api/items/:id` with `status: SOLD`: auto-calculate `netProfit`
- On `GET /api/items/stats`: return `{ revenueWeek, revenueMonth, revenueYear, netProfitMonth, inventoryValue, countByStatus }`

**🐛 Bug Check:**
- [ ] Test every route with curl or Bruno — confirm correct status codes
- [ ] `POST /api/items` with missing required fields → returns 400 with clear error
- [ ] `GET /api/items` without session → returns 401
- [ ] Create item → change status to SOLD → `netProfit` is correctly calculated
- [ ] `GET /api/items/stats` returns correct numbers matching seeded data
- [ ] Upload a photo — confirm file saved to `/backend/uploads/` and `photoUrl` stored in DB
- [ ] Rate limiter triggers after 100 requests — returns 429

**Git:** `git add . && git commit -m "step-4: backend API core CRUD and business logic"`

---

### STEP 5 — FRONTEND DASHBOARD (CORE UI)

**Design system:**
- Dark theme: background `#0a0a0a`, cards `#141414`, borders `#2a2a2a`
- Accent: gold `#c9a84c` for luxury feel
- Font: Inter (loaded from Google Fonts)
- Status badge colors: SOURCED=blue, IN_TRANSIT=amber, IN_STOCK=green, SOLD=gray
- All spacing via Tailwind utility classes

**Pages to build:**

**Login** — centered card, logo placeholder, password input, submit button

**Dashboard Home:**
- Top row: 5 KPI cards (Revenue Month, Revenue Year, Net Profit Month, Inventory Value, Items by Status)
- AI Insights panel (forecast summary + top runner recommendation)
- Quick nav tiles to each section

**Future Stock (SOURCED):**
- Card grid (2 col mobile, 4 col desktop)
- Each card: photo, brand/model/grade, purchase price, runner name, aging timer
- Cards > 14 days: red border + pulsing ⚠️ badge + "X days in [location]"

**In Transit:**
- Same card grid — show days in transit

**In Stock:**
- Card grid — show listed price, quick edit button for price

**Sold:**
- Table view — columns: photo, brand/model, sale price, purchase price, net profit, margin %, sold date, source badge

**Transactions:**
- Table: date, description, amount, category pill, linked item (or "Unlinked" button)

**Settings:**
- Change password, Gmail sync status + manual trigger, Wise sync status + manual trigger, runner management

**Global UI elements:**
- Floating `+` button (bottom-right, always visible) → opens Quick Intake modal
- Top nav: section title + "Last synced: X min ago" + mode badge (DEMO/LIVE)
- Alert banner: dismissible, appears when any SOURCED item > 14 days

**Quick Intake Modal:**
- Step 1: tap to upload photo (from camera roll or file)
- Step 2: Brand/Model input (autocomplete from past entries)
- Step 3: Grade (A / B / C / Ungraded)
- Step 4: Purchase Price + currency selector (EUR / NGN / KES / GBP)
- Step 5: Runner selector (existing runners or type new name)
- Step 6: Notes (optional)
- Submit → auto-status = SOURCED, auto-timestamp, show AI time-to-sell estimate

**🐛 Bug Check:**
- [ ] Open at 1280px — all sections render, no overflow
- [ ] Open at 375px (Chrome DevTools iPhone SE) — no horizontal scroll, all buttons tappable
- [ ] Create item via Quick Intake → appears in Future Stock immediately
- [ ] Change item status → card moves to correct section instantly
- [ ] KPI cards show correct numbers
- [ ] Alert banner appears when a seeded item is > 14 days old
- [ ] Browser console: zero errors, zero warnings

**Git:** `git add . && git commit -m "step-5: frontend dashboard core UI all views"`

---

### STEP 6 — GMAIL INTEGRATION (VINTED SALE DETECTION)

**DEMO MODE:** Return a hardcoded fake parsed email result — do not call Google at all.

**LIVE MODE:**
- Google OAuth 2.0 flow using credentials from `.env`
- Save refresh token to DB after first auth
- Background job every 10 minutes: poll Gmail for `from:(noreply@vinted.fr OR noreply@vinted.com)`
- Parse subject for "Vous avez vendu" / "You've sold"
- Extract from body: price (regex `/€[\s]*([\d,.]+)/`), item title, order ID
- Match to IN_STOCK item by name similarity (use Levenshtein distance, threshold 0.7)
- If match → mark SOLD, set `saleSource = "AUTO_GMAIL"`
- If no match → log to `unmatched_sales.log` for manual review
- Store sync result in `GmailSync` table

**🐛 Bug Check:**
- [ ] DEMO: trigger manual sync → returns fake parsed result → item marked SOLD
- [ ] LIVE: OAuth flow completes, token saved
- [ ] LIVE: manual sync polls Gmail and logs result count
- [ ] LIVE: send yourself a test email with subject "Vous avez vendu" and confirm parsing
- [ ] Unmatched sale creates a log entry (not a crash)
- [ ] `GmailSync` table updated after every sync

**Git:** `git add . && git commit -m "step-6: Gmail OAuth and Vinted sale auto-detection"`

---

### STEP 7 — WISE API INTEGRATION

**DEMO MODE:** Return a hardcoded list of 5 fake transactions.

**LIVE MODE:**
- Authenticate with `WISE_API_KEY` from `.env`
- `GET /v1/profiles` → store `WISE_PROFILE_ID`
- Background job every 6 hours: `GET /v3/profiles/{profileId}/transfers?status=outgoing_payment_sent`
- Dedup by `wiseId`, save new records only
- Auto-categorize:
  - "DHL" / "UPS" / "Colissimo" → SHIPPING
  - Any runner name → RUNNER_PAYMENT
  - Amount > €200 + "transfer" → STOCK_PURCHASE
  - Else → OTHER

**🐛 Bug Check:**
- [ ] DEMO: transactions table shows 5 fake entries
- [ ] LIVE: API call succeeds, transactions saved to DB
- [ ] Duplicate sync does not create duplicate records
- [ ] Link a transaction to an item — confirm it shows on item detail page
- [ ] Category auto-assignment works for each keyword rule

**Git:** `git add . && git commit -m "step-7: Wise API expense tracking and transaction matching"`

---

### STEP 8 — AI FEATURES (CLAUDE API)

**DEMO MODE:** Return hardcoded JSON for all three features.

**LIVE MODE:** Use `claude-haiku-4-5` model via Anthropic API.

**Feature 1 — Time-to-Sell (on Quick Intake save):**
```
System: You are a pricing analyst for a luxury secondhand bag reseller on Vinted.
User: Analyze the last 90 days of sales: {soldItemsSummary}. 
      New item: {brand} {model} {grade} {color}.
      Return JSON only: { daysToSell: number, recommendedPrice: number, confidence: "high"|"medium"|"low", reasoning: string }
```

**Feature 2 — Sourcing ROI by Runner (weekly):**
```
System: You are a supply chain analyst for a luxury reseller.
User: Sales data grouped by runner: {runnerStats}.
      Return JSON: [{ runnerName, location, avgMarginPct, avgDaysToSell, totalItems, totalProfit, recommendation }]
      Sort by highest ROI. Add a top-level "priorityThisWeek" field naming the best runner.
```

**Feature 3 — Revenue Forecast (monthly):**
```
System: You are a financial forecasting analyst.
User: Last 3 months weekly sales: {weeklySales}. Current inventory value: €{inventoryValue}. Items stuck >14 days: {stuckItems}.
      Return JSON: { forecastRevenue: number, forecastProfit: number, confidence: "high"|"medium"|"low", risks: string[], narrative: string }
```

**Fallback for empty DB:**
Return: `{ message: "Not enough data yet. Add at least 5 sold items to unlock AI insights." }`

**🐛 Bug Check:**
- [ ] DEMO: all three endpoints return valid JSON
- [ ] LIVE: Claude API responds, token usage logged to console
- [ ] Empty DB returns graceful fallback message (not a crash)
- [ ] "Refresh AI Insights" button rate-limited to once per hour
- [ ] Insights panel renders correctly on mobile

**Git:** `git add . && git commit -m "step-8: AI features forecasting pricing and sourcing ROI"`

---

### STEP 9 — ALERTS & NOTIFICATIONS

**In-app:**
- On dashboard load: query SOURCED items where `sourcedAt < now - 14 days`
- Dismissible top banner: "⚠️ {n} bags have been stuck abroad for over 14 days"
- Those item cards: red border + pulsing icon

**Email alerts (daily at 08:00):**
- Use `node-cron`: `0 8 * * *`
- If any SOURCED item > 14 days → send email via Nodemailer using Gmail OAuth token
- Subject: `🔴 Vinted Dashboard Alert — {n} bags need attention`
- Body: table of each flagged item (name, runner, days stuck, value at risk)

**🐛 Bug Check:**
- [ ] Manually set `sourcedAt` to 15 days ago on a test item → red border appears on dashboard load
- [ ] Banner shows correct count
- [ ] Manually trigger the daily job → alert email arrives in inbox
- [ ] Dismiss banner → stays dismissed for the session (localStorage)
- [ ] Zero SOURCED items > 14 days → no banner, no email

**Git:** `git add . && git commit -m "step-9: aging alerts in-app banners and email notifications"`

---

### STEP 10 — POLISH, PERFORMANCE & SECURITY

**Security:**
- [ ] Confirm `git log --all --full-history -- .env` returns nothing (`.env` never committed)
- [ ] Confirm `git log --all --full-history -- credentials.md` returns nothing
- [ ] Session cookie: `httpOnly: true, secure: true (production), sameSite: "strict"`
- [ ] All POST/PATCH inputs sanitized with `express-validator`
- [ ] Helmet.js headers present (check in browser DevTools → Network → Response Headers)

**Performance:**
- Add Prisma indexes: `Item.status`, `Item.sourcedAt`, `Item.soldAt`, `WiseTransaction.date`
- Paginate all list endpoints: default `limit=50`, support `page` query param
- Add `loading="lazy"` on all item photo `<img>` tags
- Add loading skeleton components for all async data states

**UX polish:**
- Empty state component for every view
- Currency display helper: always format as `€1,234.56`
- "Last updated" timestamp on every view
- Settings page: manage runners, view sync logs, change password

**🐛 Bug Check:**
- [ ] Full end-to-end flow: add item → SOURCED → IN_TRANSIT → IN_STOCK → SOLD → check netProfit
- [ ] Open on real mobile device — tap every button
- [ ] Browser console: zero errors
- [ ] Network tab: API responses are gzip compressed
- [ ] 101st request in 15 min window → 429 response

**Git:** `git add . && git commit -m "step-10: security hardening performance polish and UX"`

---

### STEP 11 — DEPLOYMENT CONFIG

**Files to create:**

`railway.toml`:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "cd backend && npm run build && npm run start"
healthcheckPath = "/api/health"
healthcheckTimeout = 30
restartPolicyType = "on_failure"
```

`DEPLOYMENT.md` — write a non-developer guide covering:
1. Create Railway account
2. Create new project → add PostgreSQL plugin
3. Set all env variables (list each one with description)
4. Connect GitHub repo → deploy
5. Run `npx prisma migrate deploy` in Railway shell
6. Visit the deployed URL and log in

**🐛 Bug Check:**
- [ ] `/api/health` returns `{ status: "ok", mode: "DEMO"|"LIVE", timestamp }`
- [ ] `DEPLOYMENT.md` reviewed — every step is clear enough for a non-developer
- [ ] Zero hardcoded secrets in any file
- [ ] Zero unresolved TODO comments
- [ ] Zero `console.log` debug statements

**Final GitHub push:**
```bash
git remote add origin https://github.com/YOUR_USERNAME/vinted-dashboard.git
git branch -M main
git push -u origin main
```

**Git:** `git add . && git commit -m "step-11: railway deployment config and final cleanup" && git push origin main`

---

## PHASE 3 — DEMO TEST BEFORE GOING LIVE

After Step 11 is complete, run the following test script before switching to LIVE mode:

```
DEMO TEST CHECKLIST

[ ] Login works with DASHBOARD_PASSWORD from .env
[ ] Dashboard loads with KPI cards showing demo data
[ ] Add an item via Quick Intake — photo uploads, item appears in Future Stock
[ ] Move item: SOURCED → IN_TRANSIT → IN_STOCK → SOLD
[ ] Sold item shows correct netProfit calculation
[ ] KPI cards update in real time as items change status
[ ] Item stuck > 14 days shows red card + alert banner
[ ] Manual Gmail sync returns fake sale, marks an item as SOLD
[ ] Transactions table shows fake Wise transactions
[ ] Link a transaction to an item — shows on item detail
[ ] AI insights panel shows forecast and sourcing recommendation
[ ] Settings page loads — runner list, sync status
[ ] Open on mobile — Quick Intake completes in under 10 taps
[ ] /api/health returns 200

All boxes checked → safe to fill credentials.md and switch APP_MODE=LIVE
```

---

## GENERAL RULES

1. **Print the progress header** at the start of every response
2. **Read `credentials.md`** at the start of every session
3. **Never skip the bug check** — fix all issues before committing
4. **Never hardcode secrets** — always `process.env.VARIABLE_NAME`
5. **Commit after every step** with the exact messages shown
6. **DEMO before LIVE** — the full app must work in demo mode first
7. **Mobile first** — design at 375px, scale up to desktop
8. **Graceful failures** — broken integrations show a user-friendly message, never crash the app
9. **If unclear**, write the decision in `DECISIONS.md` and use the most sensible default
10. **Reliability over features** — the operator uses this daily; it must never be broken

---

*Last updated: June 2026 — Vinted Brand Dashboard*
