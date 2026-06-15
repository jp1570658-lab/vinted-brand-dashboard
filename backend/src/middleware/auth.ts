import { Request, Response, NextFunction } from 'express';

// Augment the session type with our single-operator auth flag.
declare module 'express-session' {
  interface SessionData {
    authenticated?: boolean;
  }
}

// Paths under /api that do NOT require a session.
const PUBLIC_PATHS = new Set<string>([
  '/api/health',
  '/api/auth/login',
  '/api/auth/me',
]);

// Path prefixes that are public (Google OAuth callback, in LIVE).
const PUBLIC_PREFIXES = ['/api/auth/google'];

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const path = req.path;

  if (!path.startsWith('/api/')) return next();
  if (PUBLIC_PATHS.has(path)) return next();
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return next();

  if (req.session?.authenticated) return next();

  return res.status(401).json({ error: 'Authentication required' });
}
