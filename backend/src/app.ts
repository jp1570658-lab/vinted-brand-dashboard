import 'dotenv/config';
import express, { Express } from 'express';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import { APP_MODE } from './services/mode';
import { UPLOADS_DIR } from './lib/uploads';
import { authMiddleware } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { itemsRouter } from './routes/items';
import { runnersRouter } from './routes/runners';
import { transactionsRouter } from './routes/transactions';
import { syncRouter } from './routes/sync';
import { aiRouter } from './routes/ai';
import { googleRouter } from './routes/google';

export function createApp(): Express {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  app.set('trust proxy', 1);

  // 1. Security headers. crossOriginResourcePolicy relaxed so the SPA can load /uploads images.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // 2. Gzip
  app.use(compression());

  // CORS (dev uses Vite proxy; allow credentials for cookie sessions)
  app.use(cors({ origin: true, credentials: true }));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 3. Rate limits (per IP, 15 min windows). One pass through every page costs
  // ~50 API calls, so the general cap is 1000 to keep normal use unblocked;
  // brute-force protection lives on the login limiter (failed attempts only).
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
    }),
  );
  app.use(
    '/api/auth/login',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      skipSuccessfulRequests: true,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many failed login attempts, please try again in 15 minutes.' },
    }),
  );

  // 4. Sessions (cookie-based)
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'insecure-dev-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    }),
  );

  // Static uploads (served before auth so <img> tags work without a session cookie on the asset).
  // UPLOADS_DIR should point at a persistent volume in production — see lib/uploads.ts.
  app.use('/uploads', express.static(UPLOADS_DIR));
  // Missing upload → clean 404, so a deleted/absent file doesn't fall through to the SPA
  // catch-all and return index.html (which renders as a broken image).
  app.use('/uploads', (_req, res) => res.status(404).json({ error: 'Image not found' }));

  // Health is public and mode-aware.
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mode: APP_MODE, timestamp: new Date().toISOString() });
  });

  // 5. Auth gate for everything else under /api.
  app.use(authMiddleware);

  // Routes
  app.use('/api/auth', authRouter);
  app.use('/api/auth/google', googleRouter);
  app.use('/api/items', itemsRouter);
  app.use('/api/runners', runnersRouter);
  app.use('/api/transactions', transactionsRouter);
  app.use('/api/sync', syncRouter);
  app.use('/api/ai', aiRouter);

  // In production, serve the built frontend.
  if (isProd) {
    const clientDir = path.resolve(__dirname, '../../frontend/dist');
    app.use(express.static(clientDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(clientDir, 'index.html')));
  }

  // 6. 404 + error handler (last).
  app.use('/api', notFoundHandler);
  app.use(errorHandler);

  return app;
}
