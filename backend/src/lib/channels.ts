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
