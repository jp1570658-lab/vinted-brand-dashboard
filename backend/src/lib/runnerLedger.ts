import { prisma } from './prisma';
import { txTotalEur } from './expenses';

/** Runner whose name appears (as a whole word) in an expense description, if exactly one does. */
export async function matchRunnerId(description: string): Promise<string | null> {
  const runners = await prisma.runner.findMany({ select: { id: true, name: true } });
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = runners.filter((r) => new RegExp('\\b' + escape(r.name) + '\\b', 'i').test(description));
  return hits.length === 1 ? hits[0].id : null;
}

export interface RunnerBalance {
  runnerId: string;
  name: string;
  location: string;
  fundsSent: number; // EUR incl. transfer fees, from expenses linked to this runner
  itemsWaiting: number; // SOURCED — paid for, not yet shipped
  itemsShipped: number; // IN_TRANSIT / IN_STOCK / SOLD
  valueWaiting: number; // EUR purchase cost of waiting bags
  valueShipped: number; // EUR purchase cost of shipped / received bags
  outstanding: number; // fundsSent − valueShipped: money not yet turned into shipped bags
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Runner balance ledger (Dashboard Upgrade §4C). Money sent = every expense linked
 * to the runner (incl. fees). A bag counts as delivered on the runner's side once
 * it leaves SOURCED (shipped / confirmed). Outstanding = sent − value of those bags.
 */
export async function runnerLedger(): Promise<RunnerBalance[]> {
  const [runners, txns, items] = await Promise.all([
    prisma.runner.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.wiseTransaction.findMany({
      where: { runnerId: { not: null } },
      select: { runnerId: true, amount: true, amountEur: true, fee: true },
    }),
    prisma.item.findMany({
      where: { runnerId: { not: null }, deletedAt: null },
      select: { runnerId: true, status: true, purchasePriceEur: true },
    }),
  ]);

  return runners.map((r) => {
    const sent = txns.filter((t) => t.runnerId === r.id).reduce((s, t) => s + txTotalEur(t), 0);
    const mine = items.filter((i) => i.runnerId === r.id);
    const waiting = mine.filter((i) => i.status === 'SOURCED');
    const shipped = mine.filter((i) => i.status !== 'SOURCED');
    const cost = (list: typeof mine) => list.reduce((s, i) => s + (i.purchasePriceEur ?? 0), 0);
    return {
      runnerId: r.id,
      name: r.name,
      location: r.location,
      fundsSent: r2(sent),
      itemsWaiting: waiting.length,
      itemsShipped: shipped.length,
      valueWaiting: r2(cost(waiting)),
      valueShipped: r2(cost(shipped)),
      outstanding: r2(sent - cost(shipped)),
    };
  });
}
