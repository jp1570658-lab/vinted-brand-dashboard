import 'dotenv/config';
import express, { Express } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { APP_MODE } from './services/mode';

/**
 * Builds the Express app. Routes and the full middleware stack are wired in
 * Step 4; Step 2 ships a bootable server with a health check only.
 */
export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', mode: APP_MODE, timestamp: new Date().toISOString() });
  });

  return app;
}
