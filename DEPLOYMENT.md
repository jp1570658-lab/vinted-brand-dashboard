# DEPLOYMENT.md — Going Live (non-developer guide)

This guide takes you from a working DEMO build to a live, password-protected
dashboard on the internet. No coding required — just follow each step in order.

You will use **Railway** (hosting) + **Supabase** (database). Both have free tiers.

---

## Before you start

You need:
- A **GitHub** account with this project pushed to a repository
- A **Railway** account → https://railway.app (sign in with GitHub)
- A **Supabase** account → https://supabase.com

Set aside ~30 minutes.

---

## Step 1 — Create the database (Supabase)

1. Go to https://supabase.com → **New project**.
2. Pick a name, a strong database password (save it), and a region near you.
3. Wait ~2 minutes for it to provision.
4. Left sidebar → **Project Settings** → **Database** → **Connection string** →
   choose **URI**. Copy it. It looks like:
   `postgresql://postgres:[YOUR-PASSWORD]@db.xxxx.supabase.co:5432/postgres`
5. Replace `[YOUR-PASSWORD]` with the password from step 2. Keep this safe — it is your `DATABASE_URL`.

> The app ships in SQLite (DEMO). To use Postgres, change one line in
> `backend/prisma/schema.prisma`: set `provider = "postgresql"` in the
> `datasource db` block, then commit and push. Railway will run the migration in Step 5.

---

## Step 2 — Get your other credentials

Fill in `credentials.md` locally (never commit it). You need:

| Variable | Where to get it |
|---|---|
| `DASHBOARD_PASSWORD` | Make up a strong password — this is your login. |
| `DATABASE_URL` | From Step 1. |
| `SESSION_SECRET` | Any long random string. Generate one: open a terminal and run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | https://console.cloud.google.com → APIs & Services → Credentials → OAuth 2.0. (Only needed for live Gmail sale detection.) |
| `WISE_API_KEY` / `WISE_PROFILE_ID` | https://wise.com → Settings → API tokens. (Only needed for live expense tracking.) |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys. (Only needed for live AI insights.) |

> You can go live with just `DASHBOARD_PASSWORD`, `DATABASE_URL`, and `SESSION_SECRET`.
> Leave the integration keys blank to keep those features in mock mode, or set
> `APP_MODE=DEMO` to keep everything mocked.

---

## Step 3 — Create the Railway project

1. Go to https://railway.app → **New Project** → **Deploy from GitHub repo**.
2. Select this repository. Railway detects `railway.toml` automatically.
3. It will start a first build — that's fine, it will fail until we add variables.

---

## Step 4 — Set environment variables in Railway

In your Railway project → **Variables** → add each of these (one per row):

```
APP_MODE=LIVE                # or DEMO to keep integrations mocked
DASHBOARD_PASSWORD=...        # your login password (Step 2)
DATABASE_URL=...              # the Supabase URI (Step 1)
SESSION_SECRET=...            # long random string (Step 2)
NODE_ENV=production
PORT=3001

# Only if using live integrations:
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR-RAILWAY-URL/api/auth/google/callback
WISE_API_KEY=...
WISE_PROFILE_ID=...
ANTHROPIC_API_KEY=...

# Only if using live email alerts (Gmail app password):
ALERT_EMAIL_USER=you@gmail.com
ALERT_EMAIL_PASS=your-16-char-app-password
ALERT_EMAIL_TO=you@gmail.com
```

Click **Deploy** to rebuild with the variables in place.

---

## Step 5 — Run the database migration

The `start` command runs `prisma migrate deploy` automatically on every boot, so
your tables are created on first deploy. If you ever need to run it by hand:

1. Railway project → your service → **⋯** menu → **Shell** (or use the Railway CLI).
2. Run:
   ```
   cd backend && npx prisma migrate deploy
   ```

> Switching the schema from SQLite to PostgreSQL (Step 1 note)? After changing the
> provider, the existing migration is SQLite-shaped. Regenerate it once locally with
> `npx prisma migrate dev --name init_pg` against your Postgres `DATABASE_URL`,
> commit, and push.

---

## Step 6 — Open your dashboard

1. Railway → your service → **Settings** → **Networking** → **Generate Domain**.
2. Visit the generated URL (e.g. `https://vinted-dashboard-production.up.railway.app`).
3. Visit `https://YOUR-URL/api/health` — it should show
   `{ "status": "ok", "mode": "LIVE", "timestamp": "..." }`.
4. Open the root URL and log in with your `DASHBOARD_PASSWORD`.

You're live. 🎉

---

## Optional — connect Gmail (live sale detection)

After the app is deployed with Google credentials set:

1. In Google Cloud Console, add `https://YOUR-URL/api/auth/google/callback` to the
   OAuth client's **Authorized redirect URIs**.
2. Visit `https://YOUR-URL/api/auth/google` while logged in — approve access.
3. The refresh token is stored automatically; the 10-minute poller starts detecting Vinted sale emails.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build fails | Check the Railway build logs. Usually a missing variable. |
| `/api/health` shows `mode: DEMO` unexpectedly | Set `APP_MODE=LIVE` in Variables and redeploy. |
| Login says "DASHBOARD_PASSWORD is not configured" | Add the variable in Railway and redeploy. |
| Database errors | Re-check `DATABASE_URL`, and that the schema `provider` matches (postgresql for Supabase). |
| AI / Gmail / Wise show mock data | Those keys are blank or `APP_MODE=DEMO`. Add the keys and set `APP_MODE=LIVE`. |
