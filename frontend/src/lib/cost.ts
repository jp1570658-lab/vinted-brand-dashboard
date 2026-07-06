import type { Item } from '../api/types';

/** Total landed cost of an item in EUR (purchase + shipping + customs). */
export function totalCost(it: Item): number {
  return (it.purchasePriceEur ?? 0) + (it.shippingCost ?? 0) + (it.customsFees ?? 0);
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
