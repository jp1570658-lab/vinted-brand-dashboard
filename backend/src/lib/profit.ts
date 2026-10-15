import type { Item } from '@prisma/client';

/** Every EUR cost field that makes up an item's landed cost. */
export const COST_FIELDS = [
  'purchasePriceEur',
  'shippingCost', // inbound freight share
  'customsFees',
  'authFee',
  'otherCosts',
  'platformFee',
  'outboundShipping',
] as const;

export type CostFields = Partial<Record<(typeof COST_FIELDS)[number], number | null>>;

/** Total landed cost in EUR — the sum of every recorded cost (missing → 0). */
export function landedCost(item: CostFields): number {
  return COST_FIELDS.reduce((sum, f) => sum + (item[f] ?? 0), 0);
}

/**
 * True net profit on a sale: salePrice minus the full landed cost (sourcing,
 * inbound freight, customs, authentication, other, platform fee, outbound shipping).
 * (DECISIONS.md #12, #21)
 */
export function calcNetProfit(item: CostFields & { salePrice?: number | null }): number | null {
  if (item.salePrice == null) return null;
  return +(item.salePrice - landedCost(item)).toFixed(2);
}

/** Margin as a percentage of sale price. */
export function calcMarginPct(item: Pick<Item, 'salePrice' | 'netProfit'>): number | null {
  if (item.salePrice == null || item.netProfit == null || item.salePrice === 0) return null;
  return +((item.netProfit / item.salePrice) * 100).toFixed(1);
}
