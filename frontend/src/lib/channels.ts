/** Where a bag can be sold. Kept in sync with backend/src/lib/channels.ts. */
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

/** "Instagram & Depop" / "Instagram, Depop & WhatsApp". */
export function joinPlatforms(list: string[]): string {
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`;
}

/** Cross-listing reminder text for a sold bag still listed elsewhere. */
export function delistMessage(list: string[]): string {
  return `Marked as sold: remember to delete / mark reserved on ${joinPlatforms(list)}.`;
}
