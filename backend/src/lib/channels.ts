/** Where a bag can be sold (Dashboard Upgrade §1). Kept in sync with frontend/src/lib/channels.ts. */
export const SALE_CHANNELS = [
  'Vinted',
  'Depop',
  'Vestiaire Collective',
  'WhatsApp',
  'Instagram',
  'Direct Pickup',
  'Other',
] as const;

/** How the money for a sale arrived. */
export const PAYMENT_METHODS = [
  'Platform payout',
  'Wise',
  'Bank transfer',
  'Cash',
  'Payconiq',
  'PayPal',
  'Stripe',
] as const;

/** Parse the stored comma-separated `Item.listedOn` into channel names. */
export function parseListedOn(v: string | null | undefined): string[] {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Cross-listing reminder: platforms a SOLD bag is still advertised on, other than
 * the one it sold on — these listings must be deleted / marked reserved.
 */
export function delistOn(item: {
  status: string;
  listedOn: string | null;
  saleChannel: string | null;
}): string[] {
  if (item.status !== 'SOLD') return [];
  return parseListedOn(item.listedOn).filter((c) => c !== item.saleChannel);
}
