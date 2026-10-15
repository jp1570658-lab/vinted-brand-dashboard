import { prisma } from './prisma';
import { txTotalEur } from './expenses';

/**
 * Accounting exports for the accountant (Dashboard Upgrade §4B): a monthly Sales
 * Journal, a Purchases & Logistics Journal and the closing-inventory valuation.
 *
 * CSV is written for Excel in a Belgian locale: `;` separator, decimal comma,
 * UTF-8 BOM and CRLF line endings, so it opens correctly with a double-click
 * (DECISIONS.md #27).
 */

type Cell = string | number | null | undefined;

const r2 = (n: number) => Math.round(n * 100) / 100;

function cell(v: Cell): string {
  if (v == null) return '';
  const s = typeof v === 'number' ? r2(v).toFixed(2).replace('.', ',') : v;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return '﻿' + [header, ...rows].map((r) => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

/** [start, end) of a YYYY-MM month in UTC. Throws on a malformed month. */
export function monthRange(month: string): { start: Date; end: Date } {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  if (!m) throw new Error('month must be YYYY-MM');
  const start = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const end = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  return { start, end };
}

/** Sales Journal: every dated sale in [start, end). */
export async function salesJournal(start: Date, end: Date): Promise<string> {
  const sold = await prisma.item.findMany({
    where: { status: 'SOLD', deletedAt: null, soldAt: { gte: start, lt: end } },
    orderBy: { soldAt: 'asc' },
  });
  let gross = 0;
  let fees = 0;
  let net = 0;
  let profit = 0;
  const rows: Cell[][] = sold.map((i) => {
    const g = i.salePrice ?? 0;
    const f = i.platformFee ?? 0;
    gross += g;
    fees += f;
    net += g - f;
    profit += i.netProfit ?? 0;
    return [
      day(i.soldAt),
      i.id,
      i.brand,
      i.model,
      i.saleChannel ?? '',
      i.paymentMethod ?? '',
      g,
      f,
      g - f,
      i.outboundShipping ?? 0,
      i.netProfit,
    ];
  });
  rows.push(['TOTAL', '', '', '', '', '', gross, fees, net, '', profit]);
  return toCsv(
    [
      'Date',
      'Item ID',
      'Brand',
      'Model',
      'Sale Platform',
      'Payment Received Via',
      'Gross Amount (EUR)',
      'Platform Fees (EUR)',
      'Net Received (EUR)',
      'Outbound Shipping (EUR)',
      'Net Profit (EUR)',
    ],
    rows,
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  STOCK_PURCHASE: 'Sourcing payment',
  RUNNER_PAYMENT: 'Runner payment',
  SHIPPING: 'Freight / shipping',
  AUTHENTICATION: 'Supplies - authentication',
  CLEANING_SUPPLIES: 'Supplies - leather cleaning & conditioning',
  PACKING_SUPPLIES: 'Supplies - packing',
  OTHER: 'Other',
};

const SOURCE_LABEL: Record<string, string> = {
  WISE: 'Wise',
  WESTERN_UNION: 'Western Union',
  BANK_TRANSFER: 'Bank transfer',
  CASH: 'Cash',
  CARD: 'Card',
  PAYPAL: 'PayPal',
  OTHER: 'Other',
};

/** Purchases & Logistics Journal: every expense dated in [start, end). */
export async function purchasesJournal(start: Date, end: Date): Promise<string> {
  const txns = await prisma.wiseTransaction.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
    include: {
      runner: { select: { name: true } },
      item: { select: { id: true, brand: true, model: true } },
      splits: { include: { item: { select: { id: true, brand: true, model: true } } } },
    },
  });
  let amount = 0;
  let fee = 0;
  let total = 0;
  const rows: Cell[][] = txns.map((t) => {
    const items = t.splits.length
      ? t.splits.map((s) => `${s.item.brand} ${s.item.model} (${s.item.id})`)
      : t.item
        ? [`${t.item.brand} ${t.item.model} (${t.item.id})`]
        : [];
    const a = t.amountEur ?? t.amount;
    amount += a;
    fee += t.fee ?? 0;
    total += txTotalEur(t);
    return [
      day(t.date),
      SOURCE_LABEL[t.source] ?? t.source,
      CATEGORY_LABEL[t.category ?? 'OTHER'] ?? t.category,
      t.description,
      t.runner?.name ?? '',
      t.amount,
      t.currency,
      a,
      t.fee ?? 0,
      txTotalEur(t),
      items.join(' | '),
    ];
  });
  rows.push(['TOTAL', '', '', '', '', '', '', amount, fee, total, '']);
  return toCsv(
    [
      'Date',
      'Paid Via',
      'Category',
      'Description',
      'Runner',
      'Amount (original)',
      'Currency',
      'Amount (EUR)',
      'Transfer Fee (EUR)',
      'Total (EUR)',
      'Linked Items',
    ],
    rows,
  );
}

/**
 * Closing inventory: bags owned at the end of `asOf` (bought on/before it, not
 * sold by then), valued at acquisition cost — purchase, inbound freight, customs,
 * authentication and restoration. Selling costs (platform fee, outbound shipping)
 * are excluded: they belong to the sale, not the stock.
 */
export async function closingInventory(asOf: Date): Promise<string> {
  const endOfDay = new Date(asOf.getTime() + 24 * 60 * 60 * 1000);
  const items = await prisma.item.findMany({
    where: {
      deletedAt: null,
      sourcedAt: { lt: endOfDay },
      // Not sold by then. Sold rows with no sale date (imports) are left out — unknowable.
      OR: [{ status: { not: 'SOLD' } }, { soldAt: { gte: endOfDay } }],
    },
    include: { runner: { select: { name: true } } },
    orderBy: { sourcedAt: 'asc' },
  });
  const held = (d: Date | null) => d != null && d < endOfDay;
  let value = 0;
  const rows: Cell[][] = items.map((i) => {
    const statusAtDate = held(i.stockAt) ? 'IN_STOCK' : held(i.transitAt) ? 'IN_TRANSIT' : 'SOURCED';
    const parts = [i.purchasePriceEur, i.shippingCost, i.customsFees, i.authFee, i.otherCosts];
    const v = parts.reduce<number>((s, x) => s + (x ?? 0), 0);
    value += v;
    return [
      i.id,
      i.brand,
      i.model,
      statusAtDate,
      day(i.sourcedAt),
      i.runner?.name ?? '',
      ...parts.map((x) => x ?? 0),
      v,
    ];
  });
  rows.push(['TOTAL', `${items.length} items`, '', '', '', '', '', '', '', '', '', value]);
  return toCsv(
    [
      'Item ID',
      'Brand',
      'Model',
      `Status on ${day(asOf)}`,
      'Sourced',
      'Runner',
      'Purchase (EUR)',
      'Inbound Freight (EUR)',
      'Customs (EUR)',
      'Authentication (EUR)',
      'Restoration / Other (EUR)',
      'Valuation at Cost (EUR)',
    ],
    rows,
  );
}
