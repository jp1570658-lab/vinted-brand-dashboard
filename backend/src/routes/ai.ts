import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getForecast, getPricing, getSourcing } from '../services/ai';

export const aiRouter = Router();

// Simple per-endpoint throttle: refresh at most once per hour (CLAUDE.md Step 8).
const ONE_HOUR = 60 * 60 * 1000;
const lastCall: Record<string, { at: number; data: any }> = {};

function throttled(key: string): any | null {
  const entry = lastCall[key];
  if (entry && Date.now() - entry.at < ONE_HOUR) return entry.data;
  return null;
}
function remember(key: string, data: any) {
  lastCall[key] = { at: Date.now(), data };
}

aiRouter.get(
  '/forecast',
  asyncHandler(async (_req, res) => {
    const cached = throttled('forecast');
    if (cached) return res.json({ ...cached, cached: true });
    const data = await getForecast();
    remember('forecast', data);
    res.json(data);
  }),
);

aiRouter.get(
  '/sourcing',
  asyncHandler(async (_req, res) => {
    const cached = throttled('sourcing');
    if (cached) return res.json({ ...cached, cached: true });
    const data = await getSourcing();
    remember('sourcing', data);
    res.json(data);
  }),
);

// Pricing is per-item, not throttled (it's part of the intake flow).
aiRouter.get(
  '/pricing/:itemId',
  asyncHandler(async (req, res) => {
    res.json(await getPricing(req.params.itemId));
  }),
);
