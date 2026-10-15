import { Router, Response } from 'express';
import { asyncHandler, HttpError } from '../middleware/errorHandler';
import { monthRange, salesJournal, purchasesJournal, closingInventory } from '../lib/accounting';

export const exportRouter = Router();

function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

function parseMonth(v: unknown) {
  try {
    return monthRange(String(v ?? ''));
  } catch {
    throw new HttpError(400, 'month must be YYYY-MM, e.g. 2026-10');
  }
}

// GET /api/export/sales?month=YYYY-MM — monthly Sales Journal (CSV)
exportRouter.get(
  '/sales',
  asyncHandler(async (req, res) => {
    const { start, end } = parseMonth(req.query.month);
    sendCsv(res, `sales-journal-${req.query.month}.csv`, await salesJournal(start, end));
  }),
);

// GET /api/export/purchases?month=YYYY-MM — monthly Purchases & Logistics Journal (CSV)
exportRouter.get(
  '/purchases',
  asyncHandler(async (req, res) => {
    const { start, end } = parseMonth(req.query.month);
    sendCsv(res, `purchases-journal-${req.query.month}.csv`, await purchasesJournal(start, end));
  }),
);

// GET /api/export/inventory?date=YYYY-MM-DD — closing inventory valuation at cost (CSV)
exportRouter.get(
  '/inventory',
  asyncHandler(async (req, res) => {
    const date = String(req.query.date ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
      throw new HttpError(400, 'date must be YYYY-MM-DD, e.g. 2026-12-31');
    }
    sendCsv(res, `closing-inventory-${date}.csv`, await closingInventory(new Date(`${date}T00:00:00Z`)));
  }),
);
