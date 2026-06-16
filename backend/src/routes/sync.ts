import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { runGmailSync, lastGmailSync } from '../services/gmail';
import { runVintedSync, lastVintedSync } from '../services/vinted';
import { runWiseSync } from '../services/wise';
import { sendAgingAlert, getFlaggedItems } from '../services/alerts';

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

syncRouter.get(
  '/wise',
  asyncHandler(async (_req, res) => {
    const result = await runWiseSync();
    res.json({ ok: true, ...result });
  }),
);
