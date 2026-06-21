import { useMemo, useState } from 'react';
import type { Item, WiseTransaction } from '../api/types';
import { api } from '../api/endpoints';
import { eur } from '../lib/format';
import { ItemImage } from './ItemImage';
import { StatusBadge } from './StatusBadge';

interface Props {
  tx: WiseTransaction;
  items: Item[];
  onClose: () => void;
  onDone: () => void;
}

type ApplyChoice = 'PURCHASE' | 'SHIPPING';

interface Picked {
  item: Item;
  amount: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function SplitItemModal({ tx, items, onClose, onDone }: Props) {
  const total = tx.amountEur ?? tx.amount;

  const [query, setQuery] = useState('');
  const [applyAs, setApplyAs] = useState<ApplyChoice>('PURCHASE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-populate from an existing split (editing).
  const [picked, setPicked] = useState<Map<string, Picked>>(() => {
    const m = new Map<string, Picked>();
    for (const s of tx.splits ?? []) {
      const item = items.find((i) => i.id === s.itemId);
      if (item) m.set(item.id, { item, amount: String(s.amount) });
    }
    return m;
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((i) => `${i.brand} ${i.model} ${i.color ?? ''}`.toLowerCase().includes(q))
      : items;
    return [...base]
      .sort((a, b) => new Date(b.sourcedAt).getTime() - new Date(a.sourcedAt).getTime())
      .slice(0, 60);
  }, [items, query]);

  const pickedList = [...picked.values()];
  const allocated = pickedList.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const remaining = round2(total - allocated);
  const over = allocated > total + 0.01;
  const valid = pickedList.length > 0 && pickedList.every((p) => Number(p.amount) > 0) && !over;

  function toggle(item: Item) {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, { item, amount: '' });
      return next;
    });
  }

  function setAmount(id: string, amount: string) {
    setPicked((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, amount });
      return next;
    });
  }

  function evenSplit() {
    const n = picked.size;
    if (n === 0) return;
    const base = round2(Math.floor((total / n) * 100) / 100);
    setPicked((prev) => {
      const next = new Map(prev);
      const ids = [...next.keys()];
      ids.forEach((id, idx) => {
        const cur = next.get(id)!;
        // Last item absorbs the rounding remainder so the split sums exactly.
        const amt = idx === n - 1 ? round2(total - base * (n - 1)) : base;
        next.set(id, { ...cur, amount: String(amt) });
      });
      return next;
    });
  }

  async function confirm() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await api.transactions.split(tx.id, {
        applyAs,
        allocations: pickedList.map((p) => ({ itemId: p.item.id, amount: Number(p.amount) })),
      });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Failed to split');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-edge bg-card sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-edge p-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-100">Split across items</h2>
            <p className="mt-0.5 text-xs text-neutral-500">
              {tx.description} · <span className="text-neutral-300">{eur(total)}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            ✕
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-edge p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items to add…"
            className="input w-full"
          />
        </div>

        {/* Item list */}
        <div className="min-h-[120px] flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {filtered.map((i) => {
              const on = picked.has(i.id);
              return (
                <li key={i.id}>
                  <button
                    onClick={() => toggle(i)}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition ${
                      on ? 'border-gold bg-gold/10' : 'border-transparent hover:border-edge hover:bg-black/20'
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                        on ? 'border-gold bg-gold text-black' : 'border-neutral-600'
                      }`}
                    >
                      {on ? '✓' : ''}
                    </span>
                    <ItemImage
                      src={i.photoUrl}
                      alt={`${i.brand} ${i.model}`}
                      className="h-9 w-9 shrink-0 rounded-md object-cover"
                      fallbackClassName="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/30 text-base"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-neutral-100">
                        {i.brand} <span className="text-neutral-400">{i.model}</span>
                      </div>
                      <StatusBadge status={i.status} />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Allocation panel */}
        <div className="border-t border-edge p-3">
          {pickedList.length === 0 ? (
            <p className="py-1 text-center text-xs text-neutral-500">
              Select two or more items to split this expense across.
            </p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-neutral-500">{pickedList.length} selected</span>
                <button onClick={evenSplit} className="text-xs text-gold hover:underline">
                  Split evenly
                </button>
              </div>
              <div className="max-h-36 space-y-1.5 overflow-y-auto">
                {pickedList.map((p) => (
                  <div key={p.item.id} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-xs text-neutral-300">
                      {p.item.brand} {p.item.model}
                    </span>
                    <div className="flex items-center gap-1 rounded-lg border border-edge px-2">
                      <span className="text-xs text-neutral-500">€</span>
                      <input
                        value={p.amount}
                        onChange={(e) => setAmount(p.item.id, e.target.value)}
                        inputMode="decimal"
                        placeholder="0.00"
                        className="w-16 bg-transparent py-1 text-right text-sm text-neutral-100 outline-none"
                      />
                    </div>
                    <button
                      onClick={() => toggle(p.item)}
                      className="text-neutral-600 hover:text-red-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Apply-as */}
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => setApplyAs('PURCHASE')}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                    applyAs === 'PURCHASE'
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-edge text-neutral-400'
                  }`}
                >
                  As purchase cost
                </button>
                <button
                  onClick={() => setApplyAs('SHIPPING')}
                  className={`rounded-lg border px-2 py-1.5 text-xs font-medium ${
                    applyAs === 'SHIPPING'
                      ? 'border-gold bg-gold/15 text-gold'
                      : 'border-edge text-neutral-400'
                  }`}
                >
                  As shipping
                </button>
              </div>

              {/* Totals */}
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-neutral-500">
                  Allocated <span className="text-neutral-200">{eur(allocated)}</span> of {eur(total)}
                </span>
                <span className={over ? 'text-red-400' : 'text-neutral-500'}>
                  {over ? `${eur(allocated - total)} over` : `${eur(remaining)} left`}
                </span>
              </div>
            </>
          )}

          {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          <button
            onClick={confirm}
            disabled={!valid || busy}
            className="btn-gold mt-3 w-full disabled:opacity-40"
          >
            {busy
              ? 'Splitting…'
              : pickedList.length > 1
                ? `Split across ${pickedList.length} items`
                : 'Select items to split'}
          </button>
        </div>
      </div>
    </div>
  );
}
