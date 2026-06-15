import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { runGmailSync, lastGmailSync } from '../services/gmail';
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

syncRouter.get(
  '/wise',
  asyncHandler(async (_req, res) => {
    const result = await runWiseSync();
    res.json({ ok: true, ...result });
  }),
);
