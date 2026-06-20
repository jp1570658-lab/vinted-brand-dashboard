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
 * LIVE: detect sales by wardrobe diff. Vinted keeps sold listings in the wardrobe
 * marked `is_closed: true`, so a sale is a listing that was ACTIVE on a previous run
 * and is now either closed or gone. (Pure disappearance never happens here, hence we
 * key off the is_closed flag.)
 *
 * Safety guard: a successful fetch always returns at least the seller's closed
 * listings. If it returns zero rows at all we assume an auth/network failure and
 * abort — a bad fetch must never mark active listings sold. An empty *active* set on
 * a non-empty wardrobe is legitimate (seller has nothing currently for sale).
 */
async function liveParsedSales(): Promise<{ listingsSeen: number; sales: ParsedSale[] }> {
  const { fetchWardrobe } = await import('./vintedLive');
  const all = await fetchWardrobe();

  if (all.length === 0) {
    throw new Error(
      'Vinted wardrobe fetch returned 0 rows — aborting (likely an expired cookie or blocked request). No items were marked sold.',
    );
  }

  const active = all.filter((c) => !c.isClosed);
  const activeIds = new Set(active.map((c) => c.vintedItemId));

  // Listings we considered active before this run.
  const previous = await prisma.vintedListing.findMany({ where: { active: true } });
  // Previously-active listings that are no longer active (now closed or removed) = sold.
  const sold = previous.filter((p) => !activeIds.has(p.vintedItemId));

  // Refresh the snapshot: every row we saw gets active = !isClosed.
  const now = new Date();
  for (const c of all) {
    await prisma.vintedListing.upsert({
      where: { vintedItemId: c.vintedItemId },
      create: {
        vintedItemId: c.vintedItemId,
        title: c.title,
        price: c.price,
        active: !c.isClosed,
        lastSeenAt: now,
      },
      update: { title: c.title, price: c.price, active: !c.isClosed, lastSeenAt: now },
    });
  }

  // Each listing that left the active set is now sold/delisted — flag it, emit a sale.
  const sales: ParsedSale[] = [];
  for (const d of sold) {
    await prisma.vintedListing.update({
      where: { vintedItemId: d.vintedItemId },
      data: { active: false, soldDetected: true },
    });
    sales.push({
      title: d.title,
      price: d.price ?? 0,
      orderId: d.vintedItemId,
      raw: 'wardrobe-diff: listing closed/sold',
    });
  }

  return { listingsSeen: active.length, sales };
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

// --- Wardrobe → dashboard import -------------------------------------------

export interface VintedImportResult {
  total: number; // listings seen in the wardrobe
  created: number; // new items added
  updatedToSold: number; // previously-imported items flipped to SOLD
  skipped: number; // already imported, nothing to change
}

/** Map a Vinted condition string onto the dashboard's A/B/C grade (null = ungraded). */
function mapGrade(condition: string | null): string | null {
  if (!condition) return null;
  const c = condition.toLowerCase();
  if (c.includes('new')) return 'A';
  if (c.includes('very good') || c.includes('good')) return 'B';
  if (c.includes('satisf')) return 'C';
  return null;
}

/**
 * Import the Vinted wardrobe into the dashboard as Item records. Active listings
 * become IN_STOCK, closed/sold listings become SOLD (sale price = listing price;
 * soldAt/netProfit left null because Vinted doesn't expose the real sale date or
 * your cost — the operator fills purchase price in afterwards). Idempotent: items
 * are de-duplicated by vintedOrderId, and a previously-imported IN_STOCK item is
 * flipped to SOLD if its listing has since closed.
 */
export async function importWardrobe(): Promise<VintedImportResult> {
  if (isDemo()) {
    throw new Error('Vinted import is only available in LIVE mode.');
  }

  const { fetchWardrobe } = await import('./vintedLive');
  const listings = await fetchWardrobe(); // also refreshes + persists the session

  let created = 0;
  let updatedToSold = 0;
  let skipped = 0;
  const now = new Date();

  for (const l of listings) {
    const existing = await prisma.item.findFirst({
      where: { vintedOrderId: l.vintedItemId, deletedAt: null },
    });

    if (existing) {
      if (l.isClosed && existing.status !== 'SOLD') {
        await prisma.item.update({
          where: { id: existing.id },
          data: {
            status: 'SOLD',
            salePrice: l.price ?? existing.salePrice,
            saleSource: 'IMPORT_VINTED',
          },
        });
        updatedToSold++;
      } else {
        skipped++;
      }
      continue;
    }

    await prisma.item.create({
      data: {
        brand: l.brand || 'Vinted',
        model: l.title,
        grade: mapGrade(l.condition),
        photoUrl: l.photoUrl,
        status: l.isClosed ? 'SOLD' : 'IN_STOCK',
        sourcedAt: now,
        stockAt: l.isClosed ? null : now,
        purchasePrice: 0,
        purchaseCurrency: 'EUR',
        purchasePriceEur: 0,
        listedPrice: l.price,
        salePrice: l.isClosed ? l.price : null,
        netProfit: null,
        vintedOrderId: l.vintedItemId,
        saleSource: l.isClosed ? 'IMPORT_VINTED' : null,
        notes: `Imported from Vinted${l.condition ? ` · ${l.condition}` : ''} · set purchase price`,
      },
    });
    created++;
  }

  return { total: listings.length, created, updatedToSold, skipped };
}
