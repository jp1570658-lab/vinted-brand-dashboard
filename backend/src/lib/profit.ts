import type { Item } from '@prisma/client';

/**
 * Net profit on a sale: salePrice minus all EUR costs. Missing costs count as 0.
 * (DECISIONS.md #12)
 */
export function calcNetProfit(item: {
  salePrice?: number | null;
  purchasePriceEur?: number | null;
  shippingCost?: number | null;
  customsFees?: number | null;
}): number | null {
  if (item.salePrice == null) return null;
  const cost =
    (item.purchasePriceEur ?? 0) + (item.shippingCost ?? 0) + (item.customsFees ?? 0);
  return +(item.salePrice - cost).toFixed(2);
}

/** Margin as a percentage of sale price. */
export function calcMarginPct(item: Pick<Item, 'salePrice' | 'netProfit'>): number | null {
  if (item.salePrice == null || item.netProfit == null || item.salePrice === 0) return null;
  return +((item.netProfit / item.salePrice) * 100).toFixed(1);
}
