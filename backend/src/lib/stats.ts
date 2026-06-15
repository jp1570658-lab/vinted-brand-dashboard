import { prisma } from './prisma';

const now = () => new Date();
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

export interface DashboardStats {
  revenueWeek: number;
  revenueMonth: number;
  revenueYear: number;
  netProfitMonth: number;
  inventoryValue: number;
  countByStatus: Record<string, number>;
}

/** Aggregates for the dashboard KPI cards. All money in EUR. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const notDeleted = { deletedAt: null };

  const sold = await prisma.item.findMany({
    where: { ...notDeleted, status: 'SOLD', soldAt: { not: null } },
    select: { salePrice: true, netProfit: true, soldAt: true },
  });

  const inStock = await prisma.item.findMany({
    where: { ...notDeleted, status: { in: ['SOURCED', 'IN_TRANSIT', 'IN_STOCK'] } },
    select: { purchasePriceEur: true, listedPrice: true },
  });

  const weekAgo = daysAgo(7);
  const monthAgo = daysAgo(30);
  const yearAgo = daysAgo(365);

  let revenueWeek = 0;
  let revenueMonth = 0;
  let revenueYear = 0;
  let netProfitMonth = 0;

  for (const s of sold) {
    const rev = s.salePrice ?? 0;
    const when = s.soldAt as Date;
    if (when >= yearAgo) revenueYear += rev;
    if (when >= monthAgo) {
      revenueMonth += rev;
      netProfitMonth += s.netProfit ?? 0;
    }
    if (when >= weekAgo) revenueWeek += rev;
  }

  // Inventory value = capital tied up (EUR purchase cost of unsold items).
  const inventoryValue = inStock.reduce((sum, i) => sum + (i.purchasePriceEur ?? 0), 0);

  const grouped = await prisma.item.groupBy({
    by: ['status'],
    where: notDeleted,
    _count: true,
  });
  const countByStatus: Record<string, number> = {
    SOURCED: 0,
    IN_TRANSIT: 0,
    IN_STOCK: 0,
    SOLD: 0,
  };
  for (const g of grouped) countByStatus[g.status] = g._count;

  void now;
  return {
    revenueWeek: +revenueWeek.toFixed(2),
    revenueMonth: +revenueMonth.toFixed(2),
    revenueYear: +revenueYear.toFixed(2),
    netProfitMonth: +netProfitMonth.toFixed(2),
    inventoryValue: +inventoryValue.toFixed(2),
    countByStatus,
  };
}
