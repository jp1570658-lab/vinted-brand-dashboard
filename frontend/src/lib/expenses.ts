import type { WiseTransaction } from '../api/types';

/** Expense categories (kept in sync with backend/src/lib/expenses.ts). */
export const CATEGORIES = [
  { key: 'STOCK_PURCHASE', label: 'Stock' },
  { key: 'RUNNER_PAYMENT', label: 'Runner' },
  { key: 'SHIPPING', label: 'Freight / shipping' },
  { key: 'AUTHENTICATION', label: 'Authentication' },
  { key: 'CLEANING_SUPPLIES', label: 'Cleaning supplies' },
  { key: 'PACKING_SUPPLIES', label: 'Packing supplies' },
  { key: 'OTHER', label: 'Other' },
] as const;

export const CATEGORY_STYLE: Record<string, string> = {
  SHIPPING: 'border-status-transit/40 bg-status-transit/15 text-status-transit',
  RUNNER_PAYMENT: 'border-status-sourced/40 bg-status-sourced/15 text-status-sourced',
  STOCK_PURCHASE: 'border-gold/40 bg-gold/15 text-gold',
  AUTHENTICATION: 'border-purple-400/40 bg-purple-400/15 text-purple-300',
  CLEANING_SUPPLIES: 'border-teal-400/40 bg-teal-400/15 text-teal-300',
  PACKING_SUPPLIES: 'border-orange-400/40 bg-orange-400/15 text-orange-300',
  OTHER: 'border-edge bg-black/20 text-neutral-400',
};

export const catLabel = (k: string | null | undefined) =>
  CATEGORIES.find((c) => c.key === k)?.label ?? 'Other';

/** Where the money left from. WISE rows come from the sync; the rest are added by hand. */
export const SOURCES = [
  { key: 'WESTERN_UNION', label: 'Western Union' },
  { key: 'BANK_TRANSFER', label: 'Bank transfer' },
  { key: 'CASH', label: 'Cash' },
  { key: 'CARD', label: 'Card' },
  { key: 'PAYPAL', label: 'PayPal' },
  { key: 'OTHER', label: 'Other' },
] as const;

export const sourceLabel = (k: string | null | undefined) =>
  k === 'WISE' || !k ? 'Wise' : (SOURCES.find((s) => s.key === k)?.label ?? k);

/** Full EUR cost of an expense: amount sent plus any transfer fee. */
export function txTotalEur(t: Pick<WiseTransaction, 'amount' | 'amountEur' | 'fee'>): number {
  return Math.round(((t.amountEur ?? t.amount) + (t.fee ?? 0)) * 100) / 100;
}
