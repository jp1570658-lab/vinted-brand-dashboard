import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

/** Collects express-validator errors and returns 400 with a clear message. */
export function handleValidation(req: Request, res: Response, next: NextFunction) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();
  const errors = result.array();
  const first = errors[0] as any;
  return res.status(400).json({
    error: first?.msg || 'Validation failed',
    fields: errors.map((e: any) => ({ field: e.path, msg: e.msg })),
  });
}
