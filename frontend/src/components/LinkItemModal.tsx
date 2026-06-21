import { useMemo, useState } from 'react';
import type { Item, WiseTransaction } from '../api/types';
import { api } from '../api/endpoints';
import { eur, money } from '../lib/format';
import { suggestItems, runnerNamesOf, SUGGEST_THRESHOLD } from '../lib/matchItem';
import { ItemImage } from './ItemImage';
import { StatusBadge } from './StatusBadge';

interface Props {
  tx: WiseTransaction;
  items: Item[];
  onClose: () => void;
  onDone: () => void;
}

type ApplyChoice = 'NONE' | 'PURCHASE' | 'SHIPPING';

const APPLY_OPTIONS: { key: ApplyChoice; label: string; hint: string }[] = [
  { key: 'NONE', label: 'Just link', hint: "Reference only — don't change the item's cost" },
  { key: 'PURCHASE', label: 'Purchase cost', hint: 'Set this as what you paid for the item' },
  { key: 'SHIPPING', label: 'Shipping', hint: 'Add this as the item shipping cost' },
];

export function LinkItemModal({ tx, items, onClose, onDone }: Props) {
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState<ApplyChoice>('NONE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amount = tx.amountEur ?? tx.amount;

  // Rank by match score so the likely item floats to the top, plus a set of
  // ids confident enough to badge as "Suggested".
  const { suggestedIds, scoreById } = useMemo(() => {
    const ranked = suggestItems(tx, items, runnerNamesOf(items));
    const scoreById = new Map(ranked.map((s) => [s.item.id, s.score]));
    const suggestedIds = new Set(
      ranked.filter((s) => s.score >= SUGGEST_THRESHOLD).map((s) => s.item.id),
    );
    return { suggestedIds, scoreById };
  }, [tx, items]);

  // Pre-select the top confident suggestion (if any).
  const topSuggestionId = useMemo(() => {
    const top = suggestItems(tx, items, runnerNamesOf(items))[0];
    return top && top.score >= SUGGEST_THRESHOLD ? top.item.id : null;
  }, [tx, items]);

  const [selected, setSelected] = useState<Item | null>(
    () => items.find((i) => i.id === topSuggestionId) ?? null,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((i) => `${i.brand} ${i.model} ${i.color ?? ''}`.toLowerCase().includes(q))
      : items;
    // Suggestions first; then most-recently sourced.
    return [...base]
      .sort((a, b) => {
        const sa = scoreById.get(a.id) ?? 0;
        const sb = scoreById.get(b.id) ?? 0;
        if (sb !== sa) return sb - sa;
        return new Date(b.sourcedAt).getTime() - new Date(a.sourcedAt).getTime();
      })
      .slice(0, 60);
  }, [items, query, scoreById]);

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.transactions.update(tx.id, {
        itemId: selected.id,
        ...(choice === 'NONE' ? {} : { applyAs: choice }),
      });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Failed to link');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-edge bg-card sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-edge p-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Link to item</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {tx.description} · <span className="text-neutral-300">{eur(amount)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-edge p-3">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brand, model, colour…"
            className="input w-full"
          />
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="p-6 text-center text-sm text-neutral-500">No matching items.</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((i) => {
                const isSel = selected?.id === i.id;
                return (
                  <li key={i.id}>
                    <button
                      onClick={() => setSelected(i)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                        isSel
                          ? 'border-gold bg-gold/10'
                          : 'border-transparent hover:border-edge hover:bg-black/20'
                      }`}
                    >
                      <ItemImage
                        src={i.photoUrl}
                        alt={`${i.brand} ${i.model}`}
                        className="h-11 w-11 shrink-0 rounded-md object-cover"
                        fallbackClassName="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-black/30 text-lg"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-neutral-100">
                            {i.brand} <span className="text-neutral-400">{i.model}</span>
                          </span>
                          {suggestedIds.has(i.id) && (
                            <span className="shrink-0 rounded-full border border-gold/40 bg-gold/15 px-1.5 py-0.5 text-[9px] font-semibold text-gold">
                              ✨ Suggested
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <StatusBadge status={i.status} />
                          <span className="text-xs text-neutral-500">
                            {i.salePrice != null
                              ? `Sold ${eur(i.salePrice)}`
                              : i.listedPrice != null
                                ? `Listed ${eur(i.listedPrice)}`
                                : money(i.purchasePrice, i.purchaseCurrency)}
                          </span>
                        </div>
                      </div>
                      {isSel && <span className="shrink-0 text-gold">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Apply-as + confirm */}
        <div className="border-t border-edge p-3">
          {selected && (
            <div className="mb-3">
              <div className="mb-1.5 text-xs text-neutral-500">
                Apply {eur(amount)} to {selected.brand} {selected.model}:
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {APPLY_OPTIONS.map((o) => (
                  <button
                    key={o.key}
                    onClick={() => setChoice(o.key)}
                    title={o.hint}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium transition ${
                      choice === o.key
                        ? 'border-gold bg-gold/15 text-gold'
                        : 'border-edge text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-[11px] text-neutral-600">
                {APPLY_OPTIONS.find((o) => o.key === choice)?.hint}
              </p>
            </div>
          )}
          {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
          <button
            onClick={confirm}
            disabled={!selected || busy}
            className="btn-gold w-full disabled:opacity-40"
          >
            {busy ? 'Linking…' : selected ? `Link to ${selected.brand}` : 'Select an item'}
          </button>
        </div>
      </div>
    </div>
  );
}
