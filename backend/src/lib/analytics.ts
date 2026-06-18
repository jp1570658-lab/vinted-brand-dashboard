import { prisma } from './prisma';

export interface MonthPoint {
  month: string; // YYYY-MM
  label: string; // e.g. "Jan 26"
  revenue: number;
  profit: number;
  units: number;
}

export interface BreakdownRow {
  key: string; // brand name or runner name
  units: number;
  revenue: number;
  profit: number;
  avgMarginPct: number | null; // blended: profit / revenue
  avgDaysToSell: number | null;
}

export interface Analytics {
  totals: {
    units: number;
    revenue: number;
    profit: number;
    avgMarginPct: number | null;
    avgDaysToSell: number | null;
  };
  monthly: MonthPoint[]; // last 6 months, chronological
  byBrand: BreakdownRow[]; // sorted by profit desc
  byRunner: BreakdownRow[]; // sorted by profit desc
  generatedAt: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function blendedMargin(revenue: number, profit: number): number | null {
  if (revenue <= 0) return null;
  return +((profit / revenue) * 100).toFixed(1);
}

function round2(n: number): number {
  return +n.toFixed(2);
}

/** Profit analytics over sold items: monthly trend + brand/runner breakdowns. */
export async function getAnalytics(): Promise<Analytics> {
  const sold = await prisma.item.findMany({
    where: { deletedAt: null, status: 'SOLD', soldAt: { not: null } },
    select: {
      brand: true,
      salePrice: true,
      netProfit: true,
      soldAt: true,
      sourcedAt: true,
      runner: { select: { name: true } },
    },
  });

  // --- Monthly buckets: last 6 calendar months including the current one ---
  const now = new Date();
  const months: MonthPoint[] = [];
  const monthIndex = new Map<string, MonthPoint>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const point: MonthPoint = {
      month: key,
      label: `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
      revenue: 0,
      profit: 0,
      units: 0,
    };
    months.push(point);
    monthIndex.set(key, point);
  }

  // --- Accumulators ---
  const brands = new Map<string, { units: number; revenue: number; profit: number; daysSum: number; daysCount: number }>();
  const runners = new Map<string, { units: number; revenue: number; profit: number; daysSum: number; daysCount: number }>();

  let totalUnits = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  let totalDaysSum = 0;
  let totalDaysCount = 0;

  for (const s of sold) {
    const soldAt = s.soldAt as Date;
    const revenue = s.salePrice ?? 0;
    const profit = s.netProfit ?? 0;

    totalUnits += 1;
    totalRevenue += revenue;
    totalProfit += profit;

    // Days-to-sell (sourced → sold), only when we have a sane positive span.
    let days: number | null = null;
    if (s.sourcedAt) {
      const span = (soldAt.getTime() - new Date(s.sourcedAt).getTime()) / DAY_MS;
      if (span >= 0) days = span;
    }
    if (days != null) {
      totalDaysSum += days;
      totalDaysCount += 1;
    }

    // Monthly bucket
    const key = `${soldAt.getFullYear()}-${String(soldAt.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthIndex.get(key);
    if (bucket) {
      bucket.revenue += revenue;
      bucket.profit += profit;
      bucket.units += 1;
    }

    // Brand breakdown
    const brandKey = s.brand || 'Unknown';
    const b = brands.get(brandKey) ?? { units: 0, revenue: 0, profit: 0, daysSum: 0, daysCount: 0 };
    b.units += 1;
    b.revenue += revenue;
    b.profit += profit;
    if (days != null) {
      b.daysSum += days;
      b.daysCount += 1;
    }
    brands.set(brandKey, b);

    // Runner breakdown
    const runnerKey = s.runner?.name ?? 'Unassigned';
    const r = runners.get(runnerKey) ?? { units: 0, revenue: 0, profit: 0, daysSum: 0, daysCount: 0 };
    r.units += 1;
    r.revenue += revenue;
    r.profit += profit;
    if (days != null) {
      r.daysSum += days;
      r.daysCount += 1;
    }
    runners.set(runnerKey, r);
  }

  const toRows = (m: Map<string, { units: number; revenue: number; profit: number; daysSum: number; daysCount: number }>): BreakdownRow[] =>
    Array.from(m.entries())
      .map(([key, v]) => ({
        key,
        units: v.units,
        revenue: round2(v.revenue),
        profit: round2(v.profit),
        avgMarginPct: blendedMargin(v.revenue, v.profit),
        avgDaysToSell: v.daysCount > 0 ? Math.round(v.daysSum / v.daysCount) : null,
      }))
      .sort((a, b) => b.profit - a.profit);

  for (const point of months) {
    point.revenue = round2(point.revenue);
    point.profit = round2(point.profit);
  }

  return {
    totals: {
      units: totalUnits,
      revenue: round2(totalRevenue),
      profit: round2(totalProfit),
      avgMarginPct: blendedMargin(totalRevenue, totalProfit),
      avgDaysToSell: totalDaysCount > 0 ? Math.round(totalDaysSum / totalDaysCount) : null,
    },
    monthly: months,
    byBrand: toRows(brands),
    byRunner: toRows(runners),
    generatedAt: new Date().toISOString(),
  };
}
