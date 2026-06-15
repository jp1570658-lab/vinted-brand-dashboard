/**
 * Currency conversion. No live FX API in this app — a static map is applied at
 * item-creation time and the EUR value is frozen on the row (purchasePriceEur)
 * so historical figures never drift. Values are the exact rates from CLAUDE.md.
 */
export const FX_TO_EUR: Record<string, number> = {
  NGN: 0.00055,
  KES: 0.0069,
  EUR: 1.0,
  GBP: 1.17,
};

export const SUPPORTED_CURRENCIES = Object.keys(FX_TO_EUR);

export function toEur(amount: number, currency: string): number {
  const rate = FX_TO_EUR[currency?.toUpperCase()] ?? 1;
  return +(amount * rate).toFixed(2);
}

export function isSupportedCurrency(currency: string): boolean {
  return currency?.toUpperCase() in FX_TO_EUR;
}
