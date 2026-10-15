import type { Item } from '../api/types';

/** Every EUR cost that makes up an item's landed cost, with its display label. */
export const COST_LINES = [
  { key: 'purchasePriceEur', label: 'Sourcing' },
  { key: 'shippingCost', label: 'Inbound freight' },
  { key: 'customsFees', label: 'Customs' },
  { key: 'authFee', label: 'Authentication' },
  { key: 'otherCosts', label: 'Restoration / other' },
  { key: 'platformFee', label: 'Platform fee' },
  { key: 'outboundShipping', label: 'Outbound shipping' },
] as const satisfies readonly { key: keyof Item; label: string }[];

/** Total landed cost of an item in EUR — the sum of every recorded cost. */
export function totalCost(it: Item): number {
  return COST_LINES.reduce((sum, l) => sum + (it[l.key] ?? 0), 0);
}

/** No purchase/shipping/customs cost recorded → profit & margin are overstated. */
export function costMissing(it: Item): boolean {
  return totalCost(it) <= 0;
}

/** A sold item whose cost was never recorded — profit is overstated until fixed. */
export function soldNeedsCost(it: Item): boolean {
  return it.status === 'SOLD' && costMissing(it);
}

/** Realised profit — prefer the stored netProfit, else derive from sale − cost. */
export function profitOf(it: Item): number {
  if (it.netProfit != null) return it.netProfit;
  if (it.salePrice != null) return it.salePrice - totalCost(it);
  return 0;
}
