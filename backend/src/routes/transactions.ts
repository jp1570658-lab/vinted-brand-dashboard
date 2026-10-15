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

const TX_INCLUDE = {
  item: { select: { id: true, brand: true, model: true } },
  splits: {
    include: { item: { select: { id: true, brand: true, model: true } } },
    orderBy: { amount: 'desc' as const },
  },
} satisfies Prisma.WiseTransactionInclude;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Fold an EUR amount into an item's cost; recompute profit if sold.
 * PURCHASE sets the purchase price (a bag has one). SHIPPING is ADDITIVE onto the
 * inbound-freight share, so a bag carried on several freight/courier legs (each
 * split across its batch) accumulates all of them (DECISIONS.md #22).
 */
async function applyCostToItem(itemId: string, applyAs: ApplyMode, amountEur: number) {
  const item = await prisma.item.findFirst({ where: { id: itemId, deletedAt: null } });
  if (!item) throw new HttpError(400, 'Linked item not found');
  const data: Prisma.ItemUpdateInput = {};
  const next = { ...item };
  if (applyAs === 'PURCHASE') {
    data.purchasePrice = next.purchasePrice = amountEur;
    data.purchaseCurrency = next.purchaseCurrency = 'EUR';
    data.purchasePriceEur = next.purchasePriceEur = amountEur;
  } else {
    data.shippingCost = next.shippingCost = round2((item.shippingCost ?? 0) + amountEur);
  }
  if (item.status === 'SOLD') data.netProfit = calcNetProfit(next);
  await prisma.item.update({ where: { id: item.id }, data });
}

/** Undo a previously-applied cost; recompute profit if sold. */
async function resetCostOnItem(itemId: string, applyAs: ApplyMode, amountEur: number) {
  const item = await prisma.item.findFirst({ where: { id: itemId, deletedAt: null } });
  if (!item) return;
  const data: Prisma.ItemUpdateInput = {};
  const next = { ...item };
  if (applyAs === 'PURCHASE') {
    data.purchasePrice = next.purchasePrice = 0;
    data.purchaseCurrency = next.purchaseCurrency = 'EUR';
    data.purchasePriceEur = next.purchasePriceEur = 0;
  } else {
    // Remove only this expense's share; clear the field once nothing is left.
    const left = round2((item.shippingCost ?? 0) - amountEur);
    data.shippingCost = next.shippingCost = left > 0.005 ? left : null;
  }
  if (item.status === 'SOLD') data.netProfit = calcNetProfit(next);
  await prisma.item.update({ where: { id: item.id }, data });
}

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
        include: TX_INCLUDE,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);
    res.json({ data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }),
);

// PATCH /api/transactions/:id  (link to item, re-categorize, optional cost apply)
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
      include: TX_INCLUDE,
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
      // Re-linking to the same item must not fold the amount in twice (freight is additive).
      if (existing.itemId !== tx.itemId) {
        await applyCostToItem(tx.itemId, applyAs, tx.amountEur ?? tx.amount);
      }
    }

    res.json(tx);
  }),
);

// POST /api/transactions/:id/split  — distribute one expense across several items.
// body: { applyAs?: 'PURCHASE'|'SHIPPING', allocations: [{ itemId, amount }] }
// Replaces any prior split (and single link) for this transaction.
transactionsRouter.post(
  '/:id/split',
  param('id').isString(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const tx = await prisma.wiseTransaction.findUnique({
      where: { id: req.params.id },
      include: { splits: true },
    });
    if (!tx) throw new HttpError(404, 'Transaction not found');

    const applyAs = (req.body.applyAs ?? 'PURCHASE') as ApplyMode;
    if (!APPLY_MODES.includes(applyAs)) {
      throw new HttpError(400, `applyAs must be one of: ${APPLY_MODES.join(', ')}`);
    }

    const raw = req.body.allocations;
    if (!Array.isArray(raw) || raw.length === 0) {
      throw new HttpError(400, 'allocations must be a non-empty array');
    }
    const allocations = raw.map((a) => ({ itemId: String(a.itemId), amount: Number(a.amount) }));
    for (const a of allocations) {
      if (!a.itemId || !Number.isFinite(a.amount) || a.amount <= 0) {
        throw new HttpError(400, 'Each allocation needs an itemId and a positive amount');
      }
    }
    const ids = new Set(allocations.map((a) => a.itemId));
    if (ids.size !== allocations.length) {
      throw new HttpError(400, 'Each item can appear only once in a split');
    }
    const total = tx.amountEur ?? tx.amount;
    const sum = allocations.reduce((s, a) => s + a.amount, 0);
    if (sum > total + 0.01) {
      throw new HttpError(
        400,
        `Allocations (€${sum.toFixed(2)}) exceed the transaction amount (€${total.toFixed(2)})`,
      );
    }
    const found = await prisma.item.findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
      select: { id: true },
    });
    if (found.length !== ids.size) throw new HttpError(400, 'One or more items not found');

    // Undo the previous split, then apply the new one.
    for (const old of tx.splits) {
      await resetCostOnItem(old.itemId, old.applyAs as ApplyMode, old.amount);
    }
    await prisma.transactionSplit.deleteMany({ where: { transactionId: tx.id } });

    for (const a of allocations) {
      await prisma.transactionSplit.create({
        data: { transactionId: tx.id, itemId: a.itemId, amount: a.amount, applyAs },
      });
      await applyCostToItem(a.itemId, applyAs, a.amount);
    }
    // A split supersedes any single link.
    if (tx.itemId) {
      await prisma.wiseTransaction.update({
        where: { id: tx.id },
        data: { item: { disconnect: true } },
      });
    }

    const updated = await prisma.wiseTransaction.findUnique({
      where: { id: tx.id },
      include: TX_INCLUDE,
    });
    res.json(updated);
  }),
);

// DELETE /api/transactions/:id/split  — remove the split and reset those items' costs.
transactionsRouter.delete(
  '/:id/split',
  param('id').isString(),
  handleValidation,
  asyncHandler(async (req, res) => {
    const tx = await prisma.wiseTransaction.findUnique({
      where: { id: req.params.id },
      include: { splits: true },
    });
    if (!tx) throw new HttpError(404, 'Transaction not found');

    for (const s of tx.splits) await resetCostOnItem(s.itemId, s.applyAs as ApplyMode, s.amount);
    await prisma.transactionSplit.deleteMany({ where: { transactionId: tx.id } });

    const updated = await prisma.wiseTransaction.findUnique({
      where: { id: tx.id },
      include: TX_INCLUDE,
    });
    res.json(updated);
  }),
);
