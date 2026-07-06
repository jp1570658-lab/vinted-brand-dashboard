---
description: Build/update the Vinted Brand Dashboard one phase at a time — build, test, report, then STOP for explicit approval before committing or starting the next phase.
argument-hint: [what to build or update — leave blank to be asked]
---

# /build-update — Vinted Dashboard build-test-confirm loop

You are extending an already-live project (see `CLAUDE.md`, `PLAN.md`, `DECISIONS.md` in the repo root — read all three before doing anything else). The original 11-step build in `CLAUDE.md` is complete; `git log --oneline` shows ongoing feature work committed as `type(scope): description (#N)`. This command governs **every update from now on**, one at a time, never in a batch.

Target of this run: **$ARGUMENTS** (if empty, ask the user what to build/update before doing anything else — do not guess).

## Rules for this run

1. **One phase per invocation.** A "phase" is one feature, fix, or update — not a bundle. If the request is actually several unrelated changes, say so and propose splitting it into separate `/build-update` runs.
2. **Never chain automatically.** After a phase is committed, propose the next logical phase and stop. Do not start building it without a fresh instruction or explicit "go ahead."
3. **Never skip the test step**, and never report a test as passed without actually running it.
4. **Never commit failing or half-working code.** If a test fails, fix it and re-test before showing results — don't hand the user a broken phase to review.
5. **Guardrails carried over from CLAUDE.md:**
   - Never hardcode secrets — `process.env` only.
   - Never touch `.env` or `credentials.md` contents, never commit them.
   - Never switch `APP_MODE` between DEMO/LIVE unless explicitly asked.
   - Never force-push or rewrite git history.
   - If a spec/behavior decision isn't obvious, pick the sensible default, log it in `DECISIONS.md`, and move on rather than blocking on it.

## Steps to follow, in order

### 1. Load context
- Read `CLAUDE.md`, `PLAN.md`, `DECISIONS.md`.
- Check whether `credentials.md` exists and which fields are filled → confirm current mode (DEMO/LIVE) via `backend/.env` `APP_MODE`.
- Run `git log --oneline -15` and `git status` to see the last completed phase and confirm the working tree is clean before starting.

### 2. Announce the phase
Print this header, filled in:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 PHASE
   Building      : <one-line description of this phase>
   Files touched : <expected files/dirs>
   Last commit   : <hash + message from git log>
   Mode          : DEMO | LIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Briefly state the approach (2-4 sentences) before writing code. If the change affects the DB schema, API contract, or an integration, note it explicitly — these need a migration / DECISIONS.md entry.

### 3. Build
Implement the phase. Keep the diff scoped to what was announced. Update `PLAN.md` if the change alters folder structure, schema, or routes. Add a `DECISIONS.md` row for any non-obvious judgment call.

### 4. Test — run a real checklist, not a claim
Pick whichever apply and actually execute them:
- `npx tsc --noEmit` in `backend` and/or `frontend` — zero errors
- Relevant lint pass
- `npx prisma validate` (+ `migrate dev` if schema changed)
- Manual walkthrough of the changed flow in DEMO mode (describe exact steps taken and what was observed)
- For LIVE-only integration changes: confirm graceful fallback still works when the credential/API is unavailable, since this must never crash the app
- Anything already listed under the matching step's "🐛 Bug Check" in `CLAUDE.md`

Report results as a plain pass/fail list. If anything fails, fix it and re-run the checklist before moving to step 5 — do not present a failing result as if awaiting approval.

### 5. STOP — wait for explicit confirmation
Show the test results and a short summary of what changed. Then stop and wait. Do not run `git commit` yet. Acceptable confirmations: "yes", "approved", "ship it", "looks good", or similar explicit go-ahead. If the user asks for changes instead, revise, re-test, and present again — do not commit partial approval.

### 6. Commit (only after confirmation)
```
git add <specific files — never blind `git add .` if untracked cruft exists>
git commit -m "type(scope): description"
```
Match the existing log's conventional-commit style (`feat(...)`, `fix(...)`, `chore(...)`).

### 7. Announce next
Propose 1-3 sensible next phases based on `DECISIONS.md` open items, `PLAN.md` gaps, or obvious follow-ups to what was just built. Wait for the user to pick one or give a new instruction — do not start it.
