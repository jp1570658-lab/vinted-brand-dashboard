import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';

// Implemented in Step 8 (Claude). Stubs keep the route table whole.
export const aiRouter = Router();

aiRouter.get(
  '/forecast',
  asyncHandler(async (_req, res) => {
    res.json({ pending: 'Forecast is implemented in Step 8' });
  }),
);

aiRouter.get(
  '/pricing/:itemId',
  asyncHandler(async (_req, res) => {
    res.json({ pending: 'Pricing is implemented in Step 8' });
  }),
);

aiRouter.get(
  '/sourcing',
  asyncHandler(async (_req, res) => {
    res.json({ pending: 'Sourcing ROI is implemented in Step 8' });
  }),
);
