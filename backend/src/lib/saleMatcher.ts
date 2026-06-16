import fs from 'fs';
import path from 'path';
import { prisma } from './prisma';
import { similarity } from './levenshtein';
import { calcNetProfit } from './profit';

const UNMATCHED_LOG = path.resolve(__dirname, '../../unmatched_sales.log');
const MATCH_THRESHOLD = 0.7;

/** A sale detected by any source (Gmail email or Vinted scrape). */
export interface ParsedSale {
  title: string; // item name as seen at the source
  price: number; // EUR
  orderId?: string; // Vinted order id or listing id, if known
  raw?: string;
}

/** Where a sale was detected. Stored on Item.saleSource. */
export type SaleSource = 'AUTO_GMAIL' | 'AUTO_VINTED' | 'MANUAL';

export function logUnmatched(sale: ParsedSale, reason: string): void {
  const line = `${new Date().toISOString()}\t${reason}\t${sale.title}\t€${sale.price}\t${sale.orderId ?? ''}\n`;
  try {
    fs.appendFileSync(UNMATCHED_LOG, line);
  } catch {
    /* never crash on logging */
  }
}

/**
 * Match a parsed sale to an IN_STOCK item by brand+model similarity and mark it SOLD.
 * On ties / duplicates, the OLDEST in-stock candidate wins (FIFO) — see DECISIONS.md #4.
 * Returns the sold item id, or null if nothing matched (logged for manual review).
 */
export async function matchAndSell(sale: ParsedSale, source: SaleSource): Promise<string | null> {
  const candidates = await prisma.item.findMany({
    where: { status: 'IN_STOCK', deletedAt: null },
    orderBy: { stockAt: 'asc' }, // FIFO
  });
  if (candidates.length === 0) {
    logUnmatched(sale, 'no_in_stock_items');
    return null;
  }

  let best:
    | { id: string; score: number; purchasePriceEur: number | null; shipping: number | null; customs: number | null }
    | null = null;
  for (const c of candidates) {
    const name = `${c.brand} ${c.model}`;
    const score = similarity(name, sale.title);
    if (!best || score > best.score) {
      best = {
        id: c.id,
        score,
        purchasePriceEur: c.purchasePriceEur,
        shipping: c.shippingCost,
        customs: c.customsFees,
      };
    }
  }

  if (!best || best.score < MATCH_THRESHOLD) {
    logUnmatched(sale, `below_threshold_${best?.score.toFixed(2) ?? '0'}`);
    return null;
  }

  const netProfit = calcNetProfit({
    salePrice: sale.price,
    purchasePriceEur: best.purchasePriceEur,
    shippingCost: best.shipping,
    customsFees: best.customs,
  });

  await prisma.item.update({
    where: { id: best.id },
    data: {
      status: 'SOLD',
      soldAt: new Date(),
      salePrice: sale.price,
      netProfit,
      saleSource: source,
      vintedOrderId: sale.orderId ?? null,
    },
  });
  return best.id;
}
