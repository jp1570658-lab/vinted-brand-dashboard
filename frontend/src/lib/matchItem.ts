import type { Item, WiseTransaction } from '../api/types';

// Words that carry no matching signal in a Wise description.
const STOP = new Set([
  'transfer', 'transfers', 'bag', 'bags', 'purchase', 'purchases', 'payment',
  'pay', 'paid', 'invoice', 'order', 'wise', 'vinted', 'the', 'and', 'for',
  'test', 'eur', 'ngn', 'kes', 'gbp', 'usd', 'thb', 'ref', 'reference',
]);

/** Lowercase alphanumeric tokens of length >= 3, minus stop words. */
function tokenize(s: string | null | undefined): string[] {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP.has(t));
}

export interface Suggestion {
  item: Item;
  score: number;
  reason: string;
}

// A name or runner signal must be present for a suggestion to surface — date
// proximity alone is unreliable (imported items share one sourced timestamp).
export const SUGGEST_THRESHOLD = 4;

/**
 * Rank items by how likely they match a transaction. Pure heuristic, runs
 * client-side over already-loaded data. Returns all items with score > 0,
 * best first. Use SUGGEST_THRESHOLD to decide what's confident enough to
 * surface as a one-tap suggestion.
 */
export function suggestItems(
  tx: WiseTransaction,
  items: Item[],
  runnerNames: string[] = [],
): Suggestion[] {
  const desc = (tx.description ?? '').toLowerCase();
  const descTokens = new Set(tokenize(tx.description));
  const txTime = new Date(tx.date).getTime();

  const mentionedRunner = runnerNames.find((n) => n && desc.includes(n.toLowerCase()));

  const scored: Suggestion[] = items.map((item) => {
    let score = 0;
    let reason = '';

    // Brand / model / colour tokens appearing in the description.
    const itemTokens = tokenize(`${item.brand} ${item.model} ${item.color ?? ''}`);
    let overlap = 0;
    for (const t of itemTokens) if (descTokens.has(t)) overlap += 1;
    if (item.brand && desc.includes(item.brand.toLowerCase())) overlap += 1;
    if (overlap > 0) {
      score += overlap * 5;
      reason = 'name match';
    }

    // The transaction names this item's runner.
    if (mentionedRunner && item.runner?.name?.toLowerCase() === mentionedRunner.toLowerCase()) {
      score += 4;
      if (!reason) reason = `runner ${item.runner?.name}`;
    }

    // Date proximity — tiebreaker only (never qualifies on its own).
    const days = Math.abs((txTime - new Date(item.sourcedAt).getTime()) / 86_400_000);
    if (days <= 2) score += 1;

    return { item, score, reason };
  });

  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
}

/** Unique runner names present on a set of items. */
export function runnerNamesOf(items: Item[]): string[] {
  const set = new Set<string>();
  for (const i of items) if (i.runner?.name) set.add(i.runner.name);
  return [...set];
}
