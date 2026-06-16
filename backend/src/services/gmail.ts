import { prisma } from '../lib/prisma';
import { isDemo } from './mode';
import { matchAndSell, type ParsedSale } from '../lib/saleMatcher';

export type { ParsedSale } from '../lib/saleMatcher';

export interface GmailSyncResult {
  emailCount: number;
  salesFound: number;
  matched: number;
  unmatched: number;
  soldItemIds: string[];
  details: string[];
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
    const id = await matchAndSell(sale, 'AUTO_GMAIL');
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
