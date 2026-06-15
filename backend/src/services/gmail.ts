import fs from 'fs';
import path from 'path';
import { prisma } from '../lib/prisma';
import { isDemo } from './mode';
import { similarity } from '../lib/levenshtein';
import { calcNetProfit } from '../lib/profit';

const UNMATCHED_LOG = path.resolve(__dirname, '../../unmatched_sales.log');
const MATCH_THRESHOLD = 0.7;

export interface ParsedSale {
  title: string; // item name as seen in the email
  price: number; // EUR
  orderId?: string;
  raw?: string;
}

export interface GmailSyncResult {
  emailCount: number;
  salesFound: number;
  matched: number;
  unmatched: number;
  soldItemIds: string[];
  details: string[];
}

function logUnmatched(sale: ParsedSale, reason: string) {
  const line = `${new Date().toISOString()}\t${reason}\t${sale.title}\t€${sale.price}\t${sale.orderId ?? ''}\n`;
  try {
    fs.appendFileSync(UNMATCHED_LOG, line);
  } catch {
    /* never crash on logging */
  }
}

/**
 * Match a parsed sale to an IN_STOCK item by brand+model similarity.
 * On ties / duplicates, the OLDEST in-stock candidate wins (FIFO) — see DECISIONS.md #4.
 */
async function matchAndSell(sale: ParsedSale): Promise<string | null> {
  const candidates = await prisma.item.findMany({
    where: { status: 'IN_STOCK', deletedAt: null },
    orderBy: { stockAt: 'asc' }, // FIFO
  });
  if (candidates.length === 0) {
    logUnmatched(sale, 'no_in_stock_items');
    return null;
  }

  let best: { id: string; score: number; purchasePriceEur: number | null; shipping: number | null; customs: number | null } | null =
    null;
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
      saleSource: 'AUTO_GMAIL',
      vintedOrderId: sale.orderId ?? null,
    },
  });
  return best.id;
}

/** DEMO: a hardcoded parsed sale that matches whatever is oldest in stock. */
async function demoParsedSales(): Promise<ParsedSale[]> {
  const oldest = await prisma.item.findFirst({
    where: { status: 'IN_STOCK', deletedAt: null },
    orderBy: { stockAt: 'asc' },
  });
  if (!oldest) return [];
  return [
    {
      title: `${oldest.brand} ${oldest.model}`,
      price: oldest.listedPrice ?? Math.round((oldest.purchasePriceEur ?? 100) * 1.8),
      orderId: `DEMO-${Date.now()}`,
      raw: 'Vous avez vendu un article',
    },
  ];
}

/**
 * Run a Gmail sync. DEMO returns a hardcoded parsed sale (no network).
 * LIVE polls Gmail via fetchLiveSales() (see gmailLive.ts), then matches.
 */
export async function runGmailSync(): Promise<GmailSyncResult> {
  let emailCount = 0;
  let sales: ParsedSale[] = [];

  if (isDemo()) {
    sales = await demoParsedSales();
    emailCount = sales.length;
  } else {
    const live = await import('./gmailLive');
    const res = await live.fetchLiveSales();
    sales = res.sales;
    emailCount = res.emailCount;
  }

  const soldItemIds: string[] = [];
  const details: string[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const sale of sales) {
    const id = await matchAndSell(sale);
    if (id) {
      matched++;
      soldItemIds.push(id);
      details.push(`Matched "${sale.title}" → item ${id} (€${sale.price})`);
    } else {
      unmatched++;
      details.push(`Unmatched "${sale.title}" — logged for manual review`);
    }
  }

  await prisma.gmailSync.create({
    data: { lastSyncAt: new Date(), emailCount, salesFound: sales.length },
  });

  return { emailCount, salesFound: sales.length, matched, unmatched, soldItemIds, details };
}

export async function lastGmailSync() {
  return prisma.gmailSync.findFirst({ orderBy: { lastSyncAt: 'desc' } });
}
