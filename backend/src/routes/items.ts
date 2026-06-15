import { Router } from 'express';
import { body, param } from 'express-validator';
import { Prisma, ItemStatus } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { handleValidation } from '../middleware/validate';
import { upload } from '../middleware/upload';
import { toEur, SUPPORTED_CURRENCIES } from '../services/currency';
import { calcNetProfit, calcMarginPct } from '../lib/profit';
import { getDashboardStats } from '../lib/stats';

export const itemsRouter = Router();

const STATUSES: ItemStatus[] = ['SOURCED', 'IN_TRANSIT', 'IN_STOCK', 'SOLD'];

// Timestamp stamped when an item first enters a stage.
const STAGE_FIELD: Record<ItemStatus, 'sourcedAt' | 'transitAt' | 'stockAt' | 'soldAt'> = {
  SOURCED: 'sourcedAt',
  IN_TRANSIT: 'transitAt',
  IN_STOCK: 'stockAt',
  SOLD: 'soldAt',
};

function withDerived<T extends { salePrice: number | null; netProfit: number | null }>(item: T) {
  return { ...item, marginPct: calcMarginPct(item as any) };
}

// GET /api/items  ?status=&runnerId=&from=&to=&page=&limit=
itemsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, runnerId, from, to } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));

    const where: Prisma.ItemWhereInput = { deletedAt: null };
    if (status && STATUSES.includes(status as ItemStatus)) where.status = status as ItemStatus;
    if (runnerId) where.runnerId = runnerId;
    if (from || to) {
      where.sourcedAt = {};
      if (from) (where.sourcedAt as Prisma.DateTimeFilter).gte = new Date(from);
      if (to) (where.sourcedAt as Prisma.DateTimeFilter).lte = new Date(to);
    }

    const [total, items] = await Promise.all([
      prisma.item.count({ where }),
      prisma.item.findMany({
        where,
        include: { runner: true },
        orderBy: { sourcedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    res.json({
      data: items.map(withDerived),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }),
);

// GET /api/items/stats
itemsRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    res.json(await getDashboardStats());
  }),
);

// GET /api/items/:id
itemsRouter.get(
  '/:id',
  param('id').isString(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const item = await prisma.item.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: { runner: true, wiseTransactions: true },
    });
    if (!item) throw new HttpError(404, 'Item not found');
    res.json(withDerived(item));
  }),
);

// POST /api/items  (multipart/form-data, optional photo)
itemsRouter.post(
  '/',
  upload.single('photo'),
  body('brand').isString().trim().notEmpty().withMessage('Brand is required'),
  body('model').isString().trim().notEmpty().withMessage('Model is required'),
  body('purchasePrice').notEmpty().withMessage('Purchase price is required'),
  handleValidation,
  asyncHandler(async (req, res) => {
    const b = req.body;
    const purchasePrice = Number(b.purchasePrice);
    if (!Number.isFinite(purchasePrice) || purchasePrice < 0) {
      throw new HttpError(400, 'Purchase price must be a non-negative number');
    }
    const purchaseCurrency = (b.purchaseCurrency || 'EUR').toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(purchaseCurrency)) {
      throw new HttpError(400, `Unsupported currency. Use one of: ${SUPPORTED_CURRENCIES.join(', ')}`);
    }

    let runnerId: string | null = null;
    if (b.runnerId) {
      const runner = await prisma.runner.findUnique({ where: { id: b.runnerId } });
      if (!runner) throw new HttpError(400, 'Runner not found');
      runnerId = runner.id;
    } else if (b.runnerName) {
      // Allow creating a runner inline from the Quick Intake.
      const runner = await prisma.runner.create({
        data: { name: String(b.runnerName), location: String(b.runnerLocation || 'Unknown') },
      });
      runnerId = runner.id;
    }

    const item = await prisma.item.create({
      data: {
        brand: String(b.brand).trim(),
        model: String(b.model).trim(),
        grade: b.grade ? String(b.grade) : null,
        color: b.color ? String(b.color) : null,
        photoUrl: req.file ? `/uploads/${req.file.filename}` : null,
        status: 'SOURCED',
        purchasePrice,
        purchaseCurrency,
        purchasePriceEur: toEur(purchasePrice, purchaseCurrency),
        notes: b.notes ? String(b.notes) : null,
        runnerId,
      },
      include: { runner: true },
    });

    res.status(201).json(withDerived(item));
  }),
);

// PATCH /api/items/:id  (edit fields and/or status transition)
itemsRouter.patch(
  '/:id',
  param('id').isString(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const existing = await prisma.item.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) throw new HttpError(404, 'Item not found');

    const b = req.body;
    const data: Prisma.ItemUpdateInput = {};

    // Simple editable fields.
    for (const f of ['brand', 'model', 'grade', 'color', 'notes', 'vintedOrderId'] as const) {
      if (b[f] !== undefined) (data as any)[f] = b[f] === null ? null : String(b[f]);
    }
    for (const f of ['shippingCost', 'customsFees', 'listedPrice', 'salePrice'] as const) {
      if (b[f] !== undefined) (data as any)[f] = b[f] === null ? null : Number(b[f]);
    }

    // Currency / purchase price recalculation.
    if (b.purchasePrice !== undefined || b.purchaseCurrency !== undefined) {
      const price = Number(b.purchasePrice ?? existing.purchasePrice);
      const currency = (b.purchaseCurrency ?? existing.purchaseCurrency).toUpperCase();
      if (!SUPPORTED_CURRENCIES.includes(currency)) {
        throw new HttpError(400, `Unsupported currency. Use: ${SUPPORTED_CURRENCIES.join(', ')}`);
      }
      data.purchasePrice = price;
      data.purchaseCurrency = currency;
      data.purchasePriceEur = toEur(price, currency);
    }

    if (b.runnerId !== undefined) {
      if (b.runnerId === null) {
        data.runner = { disconnect: true };
      } else {
        const runner = await prisma.runner.findUnique({ where: { id: b.runnerId } });
        if (!runner) throw new HttpError(400, 'Runner not found');
        data.runner = { connect: { id: runner.id } };
      }
    }

    // Status transition: stamp the stage timestamp if not already set.
    let becameSold = false;
    if (b.status !== undefined) {
      if (!STATUSES.includes(b.status)) throw new HttpError(400, 'Invalid status');
      const newStatus = b.status as ItemStatus;
      data.status = newStatus;
      const stampField = STAGE_FIELD[newStatus];
      if (!existing[stampField]) (data as any)[stampField] = new Date();
      if (newStatus === 'SOLD') becameSold = true;
    }

    // Recompute netProfit when sold or when sale-related figures change.
    const willBeSold = becameSold || existing.status === 'SOLD';
    if (willBeSold) {
      const merged = {
        salePrice: (data.salePrice as number) ?? existing.salePrice,
        purchasePriceEur: (data.purchasePriceEur as number) ?? existing.purchasePriceEur,
        shippingCost: (data.shippingCost as number) ?? existing.shippingCost,
        customsFees: (data.customsFees as number) ?? existing.customsFees,
      };
      data.netProfit = calcNetProfit(merged);
      if (becameSold && existing.saleSource == null) data.saleSource = 'MANUAL';
    }

    const updated = await prisma.item.update({
      where: { id: existing.id },
      data,
      include: { runner: true },
    });
    res.json(withDerived(updated));
  }),
);

// DELETE /api/items/:id  (soft delete)
itemsRouter.delete(
  '/:id',
  param('id').isString(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const existing = await prisma.item.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) throw new HttpError(404, 'Item not found');
    await prisma.item.update({ where: { id: existing.id }, data: { deletedAt: new Date() } });
    res.json({ ok: true });
  }),
);
