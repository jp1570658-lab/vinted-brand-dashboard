import type { WiseTransaction } from '../api/types';

/** A payment with no item link and no split — available to link/reconcile. */
export function isUnlinked(t: WiseTransaction): boolean {
  return !t.item && !(t.splits && t.splits.length > 0);
}
