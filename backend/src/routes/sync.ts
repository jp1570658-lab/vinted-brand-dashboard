import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

// Implemented in Step 6 (Gmail) and Step 7 (Wise). Stubs keep the route table whole.
export const syncRouter = Router();

syncRouter.get(
  '/gmail',
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, pending: 'Gmail sync is implemented in Step 6' });
  }),
);

syncRouter.get(
  '/wise',
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, pending: 'Wise sync is implemented in Step 7' });
  }),
);
