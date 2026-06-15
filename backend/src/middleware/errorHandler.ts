import { Request, Response, NextFunction } from 'express';

/** Thrown by routes/services to signal a specific HTTP status. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// 404 for unknown /api routes.
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: `Not found: ${req.method} ${req.path}` });
}

// Catch-all error handler. Stack is only exposed in development.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof HttpError ? err.status : err.status || 500;
  const message = err?.message || 'Internal server error';
  if (status >= 500) console.error('[error]', err);
  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' ? { stack: err?.stack } : {}),
  });
}

/** Wrap async route handlers so rejected promises reach errorHandler. */
export function asyncHandler<T extends (req: Request, res: Response, next: NextFunction) => any>(
  fn: T,
) {
  return (req: Request, res: Response, next: NextFunction) =>
    Promise.resolve(fn(req, res, next)).catch(next);
}
