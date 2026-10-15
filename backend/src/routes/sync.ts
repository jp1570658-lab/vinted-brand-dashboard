import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { runGmailSync, lastGmailSync } from '../services/gmail';
import { runVintedSync, lastVintedSync, importWardrobe } from '../services/vinted';
import { runWiseSync } from '../services/wise';
import { sendAgingAlert, getFlaggedItems } from '../services/alerts';
import { isDemo } from '../services/mode';

export const syncRouter = Router();

// Manually trigger the daily aging alert (DEMO logs to console).
syncRouter.get(
  '/alerts',
  asyncHandler(async (_req, res) => {
    const result = await sendAgingAlert();
    res.json({ ...result, flagged: await getFlaggedItems() });
  }),
);

syncRouter.get(
  '/gmail',
  asyncHandler(async (_req, res) => {
    // LIVE without Gmail set up is a normal state, not a server error.
    if (!isDemo()) {
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.json({
          ok: false,
          pending: 'Gmail is not set up: add GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET (see DEPLOYMENT.md).',
        });
      }
      const { isGmailConnected } = await import('../services/gmailLive');
      if (!(await isGmailConnected())) {
        return res.json({
          ok: false,
          pending: 'Gmail is not connected yet — open /api/auth/google once to authorize it.',
        });
      }
    }
    const result = await runGmailSync();
    res.json({ ok: true, ...result });
  }),
);

syncRouter.get(
  '/gmail/status',
  asyncHandler(async (_req, res) => {
    res.json({ last: await lastGmailSync() });
  }),
);

// Scrape the Vinted wardrobe now (manual trigger; also runs daily at 06:00).
syncRouter.get(
  '/vinted',
  asyncHandler(async (_req, res) => {
    const result = await runVintedSync();
    res.json({ ok: true, ...result });
  }),
);

syncRouter.get(
  '/vinted/status',
  asyncHandler(async (_req, res) => {
    res.json({ last: await lastVintedSync() });
  }),
);

// Import the whole Vinted wardrobe into the dashboard as items (active -> IN_STOCK,
// closed -> SOLD). Idempotent; safe to re-run.
syncRouter.post(
  '/vinted/import',
  asyncHandler(async (_req, res) => {
    const result = await importWardrobe();
    res.json({ ok: true, ...result });
  }),
);

syncRouter.get(
  '/wise',
  asyncHandler(async (_req, res) => {
    const result = await runWiseSync();
    res.json({ ok: true, ...result });
  }),
);
