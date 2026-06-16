import { prisma } from '../lib/prisma';
import { isDemo } from './mode';
import { matchAndSell, type ParsedSale } from '../lib/saleMatcher';

export interface VintedSyncResult {
  listingsSeen: number;
  salesFound: number;
  matched: number;
  unmatched: number;
  soldItemIds: string[];
  details: string[];
}

/**
 * DEMO: fabricate one sale that matches whatever is oldest in stock, so the
 * dashboard flow is testable with no Vinted credentials. Mirrors the Gmail demo.
 */
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
      orderId: `DEMO-VINTED-${Date.now()}`,
      raw: 'demo wardrobe-diff sale',
    },
  ];
}

/**
 * LIVE: detect sales by wardrobe diff. An item that was listed on a previous run
 * but has vanished from the wardrobe today is treated as sold.
 *
 * Safety guard: if the wardrobe fetch returns zero listings we assume an auth /
 * network failure and abort — a bad fetch must never mark the whole wardrobe sold.
 */
async function liveParsedSales(): Promise<{ listingsSeen: number; sales: ParsedSale[] }> {
  const { fetchWardrobe } = await import('./vintedLive');
  const current = await fetchWardrobe();

  if (current.length === 0) {
    throw new Error(
      'Vinted wardrobe fetch returned 0 listings — aborting (likely an expired cookie or blocked request). No items were marked sold.',
    );
  }

  const currentIds = new Set(current.map((c) => c.vintedItemId));

  // Listings we considered active before this run.
  const previous = await prisma.vintedListing.findMany({ where: { active: true } });
  const disappeared = previous.filter((p) => !currentIds.has(p.vintedItemId));

  // Refresh the snapshot: upsert everything currently listed as active.
  const now = new Date();
  for (const c of current) {
    await prisma.vintedListing.upsert({
      where: { vintedItemId: c.vintedItemId },
      create: {
        vintedItemId: c.vintedItemId,
        title: c.title,
        price: c.price,
        active: true,
        lastSeenAt: now,
      },
      update: { title: c.title, price: c.price, active: true, lastSeenAt: now },
    });
  }

  // Anything that vanished is now sold/delisted — flag it and emit a sale.
  const sales: ParsedSale[] = [];
  for (const d of disappeared) {
    await prisma.vintedListing.update({
      where: { vintedItemId: d.vintedItemId },
      data: { active: false, soldDetected: true },
    });
    sales.push({
      title: d.title,
      price: d.price ?? 0,
      orderId: d.vintedItemId,
      raw: 'wardrobe-diff: listing disappeared',
    });
  }

  return { listingsSeen: current.length, sales };
}

/**
 * Run a Vinted sync. DEMO fabricates a sale (no network). LIVE diffs the wardrobe,
 * then matches each detected sale to an IN_STOCK item and marks it SOLD.
 */
export async function runVintedSync(): Promise<VintedSyncResult> {
  let listingsSeen = 0;
  let sales: ParsedSale[] = [];

  if (isDemo()) {
    sales = await demoParsedSales();
    listingsSeen = sales.length;
  } else {
    const res = await liveParsedSales();
    sales = res.sales;
    listingsSeen = res.listingsSeen;
  }

  const soldItemIds: string[] = [];
  const details: string[] = [];
  let matched = 0;
  let unmatched = 0;

  for (const sale of sales) {
    const id = await matchAndSell(sale, 'AUTO_VINTED');
    if (id) {
      matched++;
      soldItemIds.push(id);
      details.push(`Matched "${sale.title}" → item ${id} (€${sale.price})`);
    } else {
      unmatched++;
      details.push(`Unmatched "${sale.title}" — logged for manual review`);
    }
  }

  await prisma.vintedSync.create({
    data: { lastSyncAt: new Date(), listingsSeen, salesFound: sales.length },
  });

  return { listingsSeen, salesFound: sales.length, matched, unmatched, soldItemIds, details };
}

export async function lastVintedSync() {
  return prisma.vintedSync.findFirst({ orderBy: { lastSyncAt: 'desc' } });
}
