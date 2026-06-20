import { prisma } from '../lib/prisma';
import { isDemo } from './mode';
import { matchAndSell, type ParsedSale } from '../lib/saleMatcher';
import { similarity } from '../lib/levenshtein';
import { calcNetProfit } from '../lib/profit';
import { cacheVintedImage } from '../lib/vintedImages';
import type { VintedListing } from './vintedLive';

export interface VintedSyncResult {
  listingsSeen: number; // active listings currently for sale
  salesFound: number; // listings that flipped active -> sold THIS run
  matched: number;
  unmatched: number;
  soldItemIds: string[];
  // Two-way reconcile counters (new):
  created: number; // dashboard items created from listings we weren't tracking
  linked: number; // manually-added items matched to a listing (no duplicate created)
  refreshed: number; // existing items whose price/likes/photo were refreshed
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

// --- shared wardrobe sync core ---------------------------------------------

const LINK_THRESHOLD = 0.82; // be strict when auto-linking to a manually-added item

/** Map a Vinted condition string onto the dashboard's A/B/C grade (null = ungraded). */
function mapGrade(condition: string | null): string | null {
  if (!condition) return null;
  const c = condition.toLowerCase();
  if (c.includes('new')) return 'A';
  if (c.includes('very good') || c.includes('good')) return 'B';
  if (c.includes('satisf')) return 'C';
  return null;
}

interface ReconcileResult {
  total: number; // listings seen in the wardrobe
  activeSeen: number; // listings still for sale
  created: number;
  linked: number;
  updatedToSold: number;
  refreshed: number;
  skipped: number;
  soldItemIds: string[];
  details: string[];
}

/** Record the per-listing snapshot mirror + append the engagement time-series row. */
async function recordSnapshots(listings: VintedListing[], now: Date): Promise<void> {
  for (const l of listings) {
    await prisma.vintedListing.upsert({
      where: { vintedItemId: l.vintedItemId },
      create: {
        vintedItemId: l.vintedItemId,
        title: l.title,
        price: l.price,
        favouriteCount: l.favouriteCount,
        active: !l.isClosed,
        lastSeenAt: now,
      },
      update: {
        title: l.title,
        price: l.price,
        favouriteCount: l.favouriteCount,
        active: !l.isClosed,
        lastSeenAt: now,
      },
    });
    await prisma.vintedListingSnapshot.create({
      data: {
        vintedItemId: l.vintedItemId,
        likes: l.favouriteCount,
        price: l.price,
        active: !l.isClosed,
        takenAt: now,
      },
    });
  }
}

/**
 * Reconcile the wardrobe into dashboard Items:
 *   - listing not tracked yet  -> create an Item (active -> IN_STOCK, closed -> SOLD)
 *   - listing already tracked   -> refresh price/likes/photo; flip IN_STOCK -> SOLD
 *                                  when it has just closed (a real sale we witnessed)
 *   - a manually-added item that looks like a listing but isn't linked yet is LINKED
 *     (by strong title match) instead of duplicated, preserving the operator's data.
 *
 * Image handling: every photo is cached onto our persistent volume (cacheVintedImage)
 * so the dashboard always has a working image even after Vinted's CDN URL expires.
 */
async function reconcileWardrobe(listings: VintedListing[], now: Date): Promise<ReconcileResult> {
  let created = 0;
  let linked = 0;
  let updatedToSold = 0;
  let refreshed = 0;
  const skipped = 0; // reserved for future use; reconcile currently refreshes or creates
  const soldItemIds: string[] = [];
  const details: string[] = [];

  // Preload manually-added items that aren't linked to a Vinted listing yet, so we
  // can attach a listing to one of them rather than creating a duplicate.
  const pool = (
    await prisma.item.findMany({ where: { vintedOrderId: null, deletedAt: null } })
  ).map((u) => ({ id: u.id, name: `${u.brand} ${u.model}`, used: false }));

  for (const l of listings) {
    let existing = await prisma.item.findFirst({
      where: { vintedOrderId: l.vintedItemId, deletedAt: null },
    });

    // Not tracked by id — try to adopt a close manual match before creating new.
    if (!existing) {
      let best: { id: string; score: number } | null = null;
      for (const c of pool) {
        if (c.used) continue;
        const score = similarity(c.name, l.title);
        if (!best || score > best.score) best = { id: c.id, score };
      }
      if (best && best.score >= LINK_THRESHOLD) {
        existing = await prisma.item.findUnique({ where: { id: best.id } });
        const entry = pool.find((p) => p.id === best!.id);
        if (entry) entry.used = true;
        if (existing) {
          linked++;
          details.push(`Linked listing "${l.title}" → existing item ${existing.id}`);
        }
      }
    }

    // Cache the photo onto our volume. Keep a user-uploaded local photo if present.
    const photoSource =
      existing?.photoUrl && existing.photoUrl.startsWith('/uploads/')
        ? existing.photoUrl
        : (l.photoUrl ?? existing?.photoUrl ?? null);
    const cachedPhoto = await cacheVintedImage(l.vintedItemId, photoSource);

    if (existing) {
      const data: Record<string, unknown> = {
        vintedOrderId: l.vintedItemId, // ensure linkage persists
        vintedLikes: l.favouriteCount ?? existing.vintedLikes,
        listedPrice: l.price ?? existing.listedPrice,
      };
      if (cachedPhoto && cachedPhoto !== existing.photoUrl) data.photoUrl = cachedPhoto;

      if (l.isClosed && existing.status !== 'SOLD') {
        // We watched this go from for-sale to closed → it sold (around now).
        const salePrice = l.price ?? existing.salePrice ?? existing.listedPrice ?? null;
        data.status = 'SOLD';
        data.soldAt = existing.soldAt ?? now;
        data.salePrice = salePrice;
        data.netProfit = calcNetProfit({
          salePrice: salePrice,
          purchasePriceEur: existing.purchasePriceEur,
          shippingCost: existing.shippingCost,
          customsFees: existing.customsFees,
        });
        data.saleSource = existing.saleSource ?? 'AUTO_VINTED';
        updatedToSold++;
        soldItemIds.push(existing.id);
        details.push(`Sold: "${l.title}" → item ${existing.id} (€${salePrice ?? '?'})`);
      } else {
        refreshed++;
      }

      await prisma.item.update({ where: { id: existing.id }, data });
      continue;
    }

    // Brand-new listing we've never tracked — create the dashboard item.
    // Backfill of already-closed listings keeps soldAt/netProfit null (we never saw
    // them active, so the real sale date and profit are unknown) to keep KPIs honest.
    await prisma.item.create({
      data: {
        brand: l.brand || 'Vinted',
        model: l.title,
        grade: mapGrade(l.condition),
        photoUrl: cachedPhoto,
        vintedLikes: l.favouriteCount,
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

  return {
    total: listings.length,
    activeSeen: listings.filter((l) => !l.isClosed).length,
    created,
    linked,
    updatedToSold,
    refreshed,
    skipped,
    soldItemIds,
    details,
  };
}

/**
 * Fetch the wardrobe once, record the snapshot/time-series, and reconcile it into the
 * dashboard. Shared by the daily sync and the manual import button. Throws on an empty
 * fetch so a failed scrape can never look like "everything sold/delisted".
 */
async function syncWardrobe(): Promise<ReconcileResult> {
  const { fetchWardrobe } = await import('./vintedLive');
  const all = await fetchWardrobe(); // also refreshes + persists the rotating session

  if (all.length === 0) {
    throw new Error(
      'Vinted wardrobe fetch returned 0 rows — aborting (likely an expired cookie or blocked request). No items were changed.',
    );
  }

  const now = new Date();
  await recordSnapshots(all, now);
  return reconcileWardrobe(all, now);
}

/**
 * Run a Vinted sync. DEMO fabricates a sale (no network). LIVE scrapes the wardrobe,
 * keeps every in-stock/sold item up to date, tracks likes over time, and marks items
 * SOLD the moment their listing closes.
 */
export async function runVintedSync(): Promise<VintedSyncResult> {
  if (isDemo()) {
    const sales = await demoParsedSales();
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
      data: { lastSyncAt: new Date(), listingsSeen: sales.length, salesFound: sales.length },
    });
    return {
      listingsSeen: sales.length,
      salesFound: sales.length,
      matched,
      unmatched,
      soldItemIds,
      created: 0,
      linked: 0,
      refreshed: 0,
      details,
    };
  }

  const r = await syncWardrobe();
  await prisma.vintedSync.create({
    data: { lastSyncAt: new Date(), listingsSeen: r.activeSeen, salesFound: r.updatedToSold },
  });
  return {
    listingsSeen: r.activeSeen,
    salesFound: r.updatedToSold,
    matched: r.updatedToSold,
    unmatched: 0,
    soldItemIds: r.soldItemIds,
    created: r.created,
    linked: r.linked,
    refreshed: r.refreshed,
    details: r.details,
  };
}

export async function lastVintedSync() {
  return prisma.vintedSync.findFirst({ orderBy: { lastSyncAt: 'desc' } });
}

// --- Wardrobe → dashboard import (manual button) ---------------------------

export interface VintedImportResult {
  total: number; // listings seen in the wardrobe
  created: number; // new items added
  linked: number; // manual items matched to a listing
  updatedToSold: number; // previously-imported items flipped to SOLD
  skipped: number; // already imported, nothing new to change
}

/**
 * Import / refresh the whole Vinted wardrobe on demand (Settings button). Same engine
 * as the daily sync, so it creates new items, links manual ones, refreshes likes and
 * photos, and flips closed listings to SOLD. Idempotent; safe to re-run.
 */
export async function importWardrobe(): Promise<VintedImportResult> {
  if (isDemo()) {
    throw new Error('Vinted import is only available in LIVE mode.');
  }
  const r = await syncWardrobe();
  return {
    total: r.total,
    created: r.created,
    linked: r.linked,
    updatedToSold: r.updatedToSold,
    skipped: r.refreshed + r.skipped,
  };
}
