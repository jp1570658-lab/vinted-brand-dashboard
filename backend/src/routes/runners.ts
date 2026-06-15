import { Router } from 'express';
import { body, param } from 'express-validator';
import { prisma } from '../lib/prisma';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { handleValidation } from '../middleware/validate';

export const runnersRouter = Router();

// GET /api/runners — with item counts for the settings page.
runnersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const runners = await prisma.runner.findMany({
      orderBy: { createdAt: 'asc' },
      include: { _count: { select: { items: true } } },
    });
    res.json({ data: runners });
  }),
);

runnersRouter.post(
  '/',
  body('name').isString().trim().notEmpty().withMessage('Name is required'),
  body('location').isString().trim().notEmpty().withMessage('Location is required'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const runner = await prisma.runner.create({
      data: {
        name: String(req.body.name).trim(),
        location: String(req.body.location).trim(),
        contact: req.body.contact ? String(req.body.contact) : null,
      },
    });
    res.status(201).json(runner);
  }),
);

runnersRouter.patch(
  '/:id',
  param('id').isString(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const existing = await prisma.runner.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Runner not found');
    const data: Record<string, unknown> = {};
    for (const f of ['name', 'location', 'contact'] as const) {
      if (req.body[f] !== undefined) data[f] = req.body[f] === null ? null : String(req.body[f]);
    }
    const runner = await prisma.runner.update({ where: { id: existing.id }, data });
    res.json(runner);
  }),
);
