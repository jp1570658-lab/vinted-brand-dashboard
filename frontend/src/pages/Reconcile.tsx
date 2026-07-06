import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Item, WiseTransaction } from '../api/types';
import { api } from '../api/endpoints';
import { TopNav } from '../components/TopNav';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { ItemImage } from '../components/ItemImage';
import { FixCostModal } from '../components/FixCostModal';
import { eur, money, shortDate } from '../lib/format';
import { soldNeedsCost, profitOf } from '../lib/cost';
import { suggestTransactions, runnerNamesOf, SUGGEST_THRESHOLD } from '../lib/matchItem';
import { useLayout } from '../hooks/useLayout';

type ApplyAs = 'PURCHASE' | 'SHIPPING';

/** A transaction is available to reconcile only if it isn't already linked/split. */
function isUnlinked(t: WiseTransaction): boolean {
  return !t.item && !(t.splits && t.splits.length > 0);
}

export function Reconcile() {
  const { refreshKey, bumpRefresh, onMenu } = useLayout();
  const [items, setItems] = useState<Item[]>([]);
  const [txns, setTxns] = useState<WiseTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTx, setBusyTx] = useState<string | null>(null);
  const [fixItem, setFixItem] = useState<Item | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.items.list({ status: 'SOLD', limit: 200 }), api.transactions.list({ limit: 200 })])
      .then(([i, t]) => {
        setItems(i.data);
        setTxns(t.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const needsCost = useMemo(() => items.filter(soldNeedsCost), [items]);
  const unlinked = useMemo(() => txns.filter(isUnlinked), [txns]);
  const runnerNames = useMemo(() => runnerNamesOf(items), [items]);

  // Best candidate payments per flagged item (confident matches only).
  const candidatesByItem = useMemo(() => {
    const map = new Map<string, WiseTransaction[]>();
    for (const it of needsCost) {
      const ranked = suggestTransactions(it, unlinked, runnerNames)
        .filter((s) => s.score >= SUGGEST_THRESHOLD)
        .slice(0, 3)
        .map((s) => s.tx);
      map.set(it.id, ranked);
    }
    return map;
  }, [needsCost, unlinked, runnerNames]);

  // Backlog headline: how many, and the sale value whose profit is overstated.
  const saleAtRisk = useMemo(
    () => needsCost.reduce((s, it) => s + (it.salePrice ?? 0), 0),
    [needsCost],
  );
  const withMatch = useMemo(
    () => needsCost.filter((it) => (candidatesByItem.get(it.id)?.length ?? 0) > 0).length,
    [needsCost, candidatesByItem],
  );

  async function apply(item: Item, tx: WiseTransaction, applyAs: ApplyAs) {
    setBusyTx(tx.id);
    try {
      await api.transactions.update(tx.id, { itemId: item.id, applyAs });
      bumpRefresh(); // keep the rest of the app in sync
      load();
    } finally {
      setBusyTx(null);
    }
  }

  return (
    <>
      <TopNav title="Reconcile" onMenu={onMenu} />
      <div className="space-y-4 p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : needsCost.length === 0 ? (
          <EmptyState
            title="Everything's reconciled"
            message="Every sold item has a purchase or shipping cost recorded — profit figures are accurate."
            icon="✅"
          />
        ) : (
          <>
            {/* Backlog summary */}
            <div className="grid grid-cols-3 gap-2">
              <Kpi label="Need cost" value={String(needsCost.length)} accent />
              <Kpi label="Have a match" value={`${withMatch}/${needsCost.length}`} />
              <Kpi label="Sale value at risk" value={eur(saleAtRisk)} />
            </div>
            <p className="px-1 text-xs text-neutral-500">
              These sold items have no recorded cost, so their profit &amp; margin are overstated.
              Apply a matching payment as the cost, or fix it manually.
            </p>

            <div className="space-y-2">
              {needsCost.map((it) => (
                <ReconcileRow
                  key={it.id}
                  item={it}
                  candidates={candidatesByItem.get(it.id) ?? []}
                  busyTx={busyTx}
                  onApply={apply}
                  onFixManually={() => setFixItem(it)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <FixCostModal item={fixItem} onClose={() => setFixItem(null)} onChanged={load} />
    </>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-edge bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${accent ? 'text-amber-300' : 'text-neutral-100'}`}>
        {value}
      </div>
    </div>
  );
}

function ReconcileRow({
  item: it,
  candidates,
  busyTx,
  onApply,
  onFixManually,
}: {
  item: Item;
  candidates: WiseTransaction[];
  busyTx: string | null;
  onApply: (item: Item, tx: WiseTransaction, applyAs: ApplyAs) => void;
  onFixManually: () => void;
}) {
  const overstated = profitOf(it);
  return (
    <div className="rounded-xl border border-amber-500/25 bg-card p-3">
      {/* Item header */}
      <div className="flex gap-3">
        <ItemImage
          src={it.photoUrl}
          alt={`${it.brand} ${it.model}`}
          className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
          fallbackClassName="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-black/30 text-xl"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-neutral-100">{it.brand}</div>
          <div className="truncate text-xs text-neutral-500">
            {it.model}
            {it.grade ? ` · Grade ${it.grade}` : ''}
            {it.runner?.name ? ` · 🏃 ${it.runner.name}` : ''}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
            <span className="text-neutral-400">
              Sold <span className="text-neutral-200">{eur(it.salePrice)}</span>
            </span>
            <span className="text-amber-300" title="Overstated until a cost is recorded">
              profit ~{eur(overstated)} ⚠
            </span>
          </div>
        </div>
      </div>

      {/* Candidate payments */}
      <div className="mt-3 border-t border-edge pt-3">
        {candidates.length === 0 ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-neutral-500">No matching payment found.</span>
            <button
              onClick={onFixManually}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
            >
              ⚙ Fix manually
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Suggested payment{candidates.length > 1 ? 's' : ''}
            </div>
            {candidates.map((tx) => {
              const amt = tx.amountEur ?? tx.amount;
              const busy = busyTx === tx.id;
              return (
                <div
                  key={tx.id}
                  className="rounded-lg border border-edge bg-black/20 p-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm text-neutral-200">{tx.description}</div>
                      <div className="text-[11px] text-neutral-500">{shortDate(tx.date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-neutral-100">{eur(amt)}</div>
                      {tx.currency !== 'EUR' && (
                        <div className="text-[10px] text-neutral-600">
                          {money(tx.amount, tx.currency)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => onApply(it, tx, 'PURCHASE')}
                      disabled={busy}
                      className="flex-1 rounded-lg border border-gold/40 bg-gold/10 px-2 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50"
                    >
                      {busy ? '…' : 'Use as purchase'}
                    </button>
                    <button
                      onClick={() => onApply(it, tx, 'SHIPPING')}
                      disabled={busy}
                      className="flex-1 rounded-lg border border-edge px-2 py-1.5 text-xs text-neutral-300 transition hover:border-gold/50 hover:text-gold disabled:opacity-50"
                    >
                      {busy ? '…' : 'Use as shipping'}
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              onClick={onFixManually}
              className="text-[11px] text-neutral-500 transition hover:text-gold"
            >
              None of these — fix manually
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
