import { Router } from 'express';
import { body } from 'express-validator';
import { handleValidation } from '../middleware/validate';
import { asyncHandler, HttpError } from '../middleware/errorHandler';

export const authRouter = Router();

authRouter.post(
  '/login',
  body('password').isString().notEmpty().withMessage('Password is required'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const expected = process.env.DASHBOARD_PASSWORD;
    if (!expected) {
      throw new HttpError(500, 'DASHBOARD_PASSWORD is not configured on the server');
    }
    if (req.body.password !== expected) {
      throw new HttpError(401, 'Incorrect password');
    }
    req.session.authenticated = true;
    res.json({ ok: true });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  }),
);

authRouter.get('/me', (req, res) => {
  res.json({ authenticated: Boolean(req.session?.authenticated) });
});
