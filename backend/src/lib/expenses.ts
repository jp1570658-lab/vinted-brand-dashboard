/**
 * Expense ledger vocabulary (Dashboard Upgrade §2, §4B). Every expense — synced
 * from Wise or added by hand (Western Union, cash, card…) — lives in the
 * WiseTransaction table; `source` says where it came from.
 * Kept in sync with frontend/src/lib/expenses.ts.
 */
export const EXPENSE_CATEGORIES = [
  'STOCK_PURCHASE',
  'RUNNER_PAYMENT',
  'SHIPPING', // freight, cargo, courier
  'AUTHENTICATION',
  'CLEANING_SUPPLIES', // saddle soap, creams, brushes, restoration
  'PACKING_SUPPLIES', // boxes, bubble wrap, mailers, tape, labels, cards
  'OTHER',
] as const;

/** Where the money left from. WISE rows come from the Wise sync. */
export const EXPENSE_SOURCES = [
  'WISE',
  'WESTERN_UNION',
  'BANK_TRANSFER',
  'CASH',
  'CARD',
  'PAYPAL',
  'OTHER',
] as const;

/** Full EUR cost of an expense: the amount sent plus any transfer fee. */
export function txTotalEur(t: { amount: number; amountEur: number | null; fee: number | null }): number {
  return Math.round(((t.amountEur ?? t.amount) + (t.fee ?? 0)) * 100) / 100;
}
