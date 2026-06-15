import { Router } from 'express';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { isDemo } from '../services/mode';

// Google OAuth routes. Public (whitelisted in auth middleware) but inert in DEMO.
export const googleRouter = Router();

googleRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    if (isDemo()) throw new HttpError(400, 'Gmail OAuth is disabled in DEMO mode');
    const { getAuthUrl } = await import('../services/gmailLive');
    res.redirect(getAuthUrl());
  }),
);

googleRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    if (isDemo()) throw new HttpError(400, 'Gmail OAuth is disabled in DEMO mode');
    const code = req.query.code as string;
    if (!code) throw new HttpError(400, 'Missing authorization code');
    const { handleOAuthCallback } = await import('../services/gmailLive');
    await handleOAuthCallback(code);
    res.send(
      '<html><body style="font-family:sans-serif;background:#0a0a0a;color:#c9a84c;text-align:center;padding-top:80px"><h2>✅ Gmail connected</h2><p>You can close this tab and return to the dashboard.</p></body></html>',
    );
  }),
);
