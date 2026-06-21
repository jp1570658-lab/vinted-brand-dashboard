import { Router } from 'express';
import { param } from 'express-validator';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { handleValidation } from '../middleware/validate';
import { calcNetProfit } from '../lib/profit';

export const transactionsRouter = Router();

// How a linked expense should feed into the item's real cost (optional).
const APPLY_MODES = ['PURCHASE', 'SHIPPING'] as const;
type ApplyMode = (typeof APPLY_MODES)[number];

// GET /api/transactions ?category=&itemId=&page=&limit=
transactionsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) || '50', 10)));
    const where: Prisma.WiseTransactionWhereInput = {};
    if (req.query.category) where.category = String(req.query.category);
    if (req.query.itemId) where.itemId = String(req.query.itemId);

    const [total, data] = await Promise.all([
      prisma.wiseTransaction.count({ where }),
      prisma.wiseTransaction.findMany({
        where,
        include: { item: { select: { id: true, brand: true, model: true } } },
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }),
);

// PATCH /api/transactions/:id  (link to item, re-categorize)
transactionsRouter.patch(
  '/:id',
  param('id').isString(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const existing = await prisma.wiseTransaction.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new HttpError(404, 'Transaction not found');

    const data: Prisma.WiseTransactionUpdateInput = {};
    if (req.body.category !== undefined) {
      data.category = req.body.category === null ? null : String(req.body.category);
    }
    if (req.body.itemId !== undefined) {
      if (req.body.itemId === null) {
        data.item = { disconnect: true };
      } else {
        const item = await prisma.item.findFirst({
          where: { id: String(req.body.itemId), deletedAt: null },
        });
        if (!item) throw new HttpError(400, 'Item not found');
        data.item = { connect: { id: item.id } };
      }
    }

    const tx = await prisma.wiseTransaction.update({
      where: { id: existing.id },
      data,
      include: { item: { select: { id: true, brand: true, model: true } } },
    });

    // Optionally fold this expense into the linked item's cost so net profit
    // reflects real money spent. Opt-in: only runs when applyAs is provided and
    // the transaction is (now) linked to an item.
    const applyAs = req.body.applyAs as ApplyMode | undefined;
    if (applyAs !== undefined && applyAs !== null) {
      if (!APPLY_MODES.includes(applyAs)) {
        throw new HttpError(400, `applyAs must be one of: ${APPLY_MODES.join(', ')}`);
      }
      if (!tx.itemId) {
        throw new HttpError(400, 'Cannot apply cost: transaction is not linked to an item');
      }
      const item = await prisma.item.findFirst({ where: { id: tx.itemId, deletedAt: null } });
      if (!item) throw new HttpError(400, 'Linked item not found');

      // Wise amounts are already normalized to EUR on import; fall back to raw.
      const amountEur = tx.amountEur ?? tx.amount;
      const itemData: Prisma.ItemUpdateInput = {};
      if (applyAs === 'PURCHASE') {
        itemData.purchasePrice = amountEur;
        itemData.purchaseCurrency = 'EUR';
        itemData.purchasePriceEur = amountEur;
      } else {
        itemData.shippingCost = amountEur;
      }

      // Recompute profit if the item is already sold.
      if (item.status === 'SOLD') {
        itemData.netProfit = calcNetProfit({
          salePrice: item.salePrice,
          purchasePriceEur: applyAs === 'PURCHASE' ? amountEur : item.purchasePriceEur,
          shippingCost: applyAs === 'SHIPPING' ? amountEur : item.shippingCost,
          customsFees: item.customsFees,
        });
      }
      await prisma.item.update({ where: { id: item.id }, data: itemData });
    }

    res.json(tx);
  }),
);
