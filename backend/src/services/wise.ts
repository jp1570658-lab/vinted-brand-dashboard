import { prisma } from '../lib/prisma';
import { isDemo } from './mode';
import { toEur } from './currency';

export interface RawTransfer {
  wiseId: string;
  date: Date;
  amount: number;
  currency: string;
  description: string;
}

export interface WiseSyncResult {
  fetched: number;
  imported: number; // new records actually saved
  duplicates: number;
  categories: Record<string, number>;
}

const SHIPPING_KEYWORDS = ['dhl', 'ups', 'colissimo', 'fedex', 'postnl'];

/** Categorize a transfer. Runner names are matched against the DB. */
async function categorize(t: RawTransfer): Promise<string> {
  const desc = t.description.toLowerCase();
  if (SHIPPING_KEYWORDS.some((k) => desc.includes(k))) return 'SHIPPING';

  const runners = await prisma.runner.findMany({ select: { name: true } });
  if (runners.some((r) => desc.includes(r.name.toLowerCase()))) return 'RUNNER_PAYMENT';

  if (t.amount > 200 && desc.includes('transfer')) return 'STOCK_PURCHASE';
  return 'OTHER';
}

/** DEMO: a fixed list of 5 realistic transfers. */
function demoTransfers(): RawTransfer[] {
  const day = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  return [
    { wiseId: 'DEMO-TX-1001', date: day(2), amount: 38.5, currency: 'EUR', description: 'DHL Express shipping label' },
    { wiseId: 'DEMO-TX-1002', date: day(5), amount: 240, currency: 'GBP', description: 'Transfer to supplier - stock batch' },
    { wiseId: 'DEMO-TX-1003', date: day(6), amount: 150, currency: 'EUR', description: 'Payment to Ada (runner)' },
    { wiseId: 'DEMO-TX-1004', date: day(9), amount: 22.9, currency: 'EUR', description: 'UPS parcel return' },
    { wiseId: 'DEMO-TX-1005', date: day(12), amount: 14.99, currency: 'EUR', description: 'Vinted Pro subscription' },
  ];
}

/**
 * Run a Wise sync. DEMO uses a fixed list; LIVE polls the Wise API
 * (see wiseLive.ts). Dedups by wiseId; categorizes new records.
 */
export async function runWiseSync(): Promise<WiseSyncResult> {
  let transfers: RawTransfer[];
  if (isDemo()) {
    transfers = demoTransfers();
  } else {
    const live = await import('./wiseLive');
    transfers = await live.fetchLiveTransfers();
  }

  let imported = 0;
  let duplicates = 0;
  const categories: Record<string, number> = {};

  for (const t of transfers) {
    const exists = await prisma.wiseTransaction.findUnique({ where: { wiseId: t.wiseId } });
    if (exists) {
      duplicates++;
      continue;
    }
    const category = await categorize(t);
    categories[category] = (categories[category] ?? 0) + 1;
    await prisma.wiseTransaction.create({
      data: {
        wiseId: t.wiseId,
        date: t.date,
        amount: t.amount,
        currency: t.currency,
        amountEur: toEur(t.amount, t.currency),
        description: t.description,
        category,
      },
    });
    imported++;
  }

  return { fetched: transfers.length, imported, duplicates, categories };
}
