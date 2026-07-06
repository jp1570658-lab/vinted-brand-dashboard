import { useEffect, useMemo, useState } from 'react';
import type { Item, WiseTransaction } from '../api/types';
import { api } from '../api/endpoints';
import { eur, money, pct, shortDate } from '../lib/format';
import { suggestTransactions, SUGGEST_THRESHOLD } from '../lib/matchItem';
import { isUnlinked } from '../lib/tx';
import { ItemImage } from './ItemImage';

interface Props {
  item: Item | null;
  onClose: () => void;
  onChanged: () => void;
}

type ApplyAs = 'PURCHASE' | 'SHIPPING';

/**
 * Quick "fix cost" shortcut for a sold item that has no recorded cost.
 *
 * Two ways to fix it:
 *  1. Reconcile from real spend — pick a matching unlinked Wise transaction and
 *     apply its amount as purchase or shipping (links the tx to the item too).
 *  2. Enter the cost manually as a fallback.
 * Either way the backend recomputes netProfit.
 */
export function FixCostModal({ item, onClose, onChanged }: Props) {
  const [purchase, setPurchase] = useState('');
  const [shipping, setShipping] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Candidate transactions to reconcile against.
  const [txns, setTxns] = useState<WiseTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  // Reset per-item state and pull unlinked transactions when the modal opens.
  useEffect(() => {
    setPurchase('');
    setShipping('');
    setError(null);
    setShowAll(false);
    if (!item) return;
    setTxLoading(true);
    api.transactions
      .list({ limit: 200 })
      .then((res) => setTxns(res.data.filter(isUnlinked)))
      .catch(() => setTxns([]))
      .finally(() => setTxLoading(false));
  }, [item]);

  // Rank the unlinked transactions against this item. Only this item's runner
  // name matters for the runner signal.
  const suggestions = useMemo(() => {
    if (!item) return [];
    const runnerNames = item.runner?.name ? [item.runner.name] : [];
    return suggestTransactions(item, txns, runnerNames);
  }, [item, txns]);

  if (!item) return null;

  const sale = item.salePrice ?? 0;
  const purchaseNum = Number(purchase) || 0;
  const shippingNum = Number(shipping) || 0;
  const customs = item.customsFees ?? 0;
  const cost = purchaseNum + shippingNum + customs;
  const profit = sale - cost;
  const margin = sale > 0 ? (profit / sale) * 100 : null;
  const canSave = purchase.trim() !== '' && Number.isFinite(purchaseNum) && purchaseNum >= 0;

  // Confident matches (name/runner signal) are the default one-tap list; weaker
  // date-only candidates only appear behind "show all".
  const confidentTxns = suggestions
    .filter((s) => s.score >= SUGGEST_THRESHOLD)
    .map((s) => s.tx);
  const confidentIds = new Set(confidentTxns.map((t) => t.id));
  // "Show all" is ranked-first (any score), then the remaining unlinked.
  const rankedIds = new Set(suggestions.map((s) => s.tx.id));
  const allOrdered = [
    ...suggestions.map((s) => s.tx),
    ...txns.filter((t) => !rankedIds.has(t.id)),
  ];
  const visibleTxns = showAll ? allOrdered : confidentTxns;

  /** Link a real transaction to this item and fold its amount into the chosen cost. */
  async function applyTransaction(tx: WiseTransaction, applyAs: ApplyAs) {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      await api.transactions.update(tx.id, { itemId: item.id, applyAs });
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not apply transaction');
      setBusy(false);
    }
  }

  async function save() {
    if (!item || !canSave) return;
    setBusy(true);
    setError(null);
    try {
      await api.items.update(item.id, {
        purchasePrice: purchaseNum,
        purchaseCurrency: 'EUR',
        ...(shipping.trim() !== '' ? { shippingCost: shippingNum } : {}),
      });
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not save cost');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-edge bg-card sm:rounded-2xl">
        <div className="sticky top-0 flex items-center gap-3 border-b border-edge bg-card p-4">
          <ItemImage
            src={item.photoUrl}
            alt={`${item.brand} ${item.model}`}
            className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
            fallbackClassName="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-black/30 text-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-neutral-100">{item.brand}</div>
            <div className="truncate text-xs text-neutral-500">{item.model}</div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            ✕
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-neutral-400">
            Set what this item cost so its profit &amp; margin are accurate. Sold for{' '}
            <span className="text-neutral-200">{eur(sale)}</span>.
          </p>

          {/* Reconcile from real Wise spend */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                From a Wise transaction
              </span>
              {txns.length > confidentTxns.length && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="text-[11px] text-neutral-500 hover:text-gold"
                >
                  {showAll ? 'Show matches only' : `Show all unlinked (${txns.length})`}
                </button>
              )}
            </div>

            {txLoading ? (
              <div className="rounded-lg border border-edge bg-black/20 p-3 text-xs text-neutral-500">
                Looking for matching transactions…
              </div>
            ) : visibleTxns.length === 0 ? (
              <div className="rounded-lg border border-edge bg-black/20 p-3 text-xs text-neutral-500">
                {txns.length === 0
                  ? 'No unlinked transactions to reconcile — enter the cost manually below.'
                  : 'No confident matches. Use “Show all unlinked” or enter the cost manually.'}
              </div>
            ) : (
              <ul className="space-y-2">
                {visibleTxns.slice(0, showAll ? 50 : 4).map((tx) => {
                  const amt = tx.amountEur ?? tx.amount;
                  const suggested = confidentIds.has(tx.id);
                  return (
                    <li
                      key={tx.id}
                      className={`rounded-lg border p-2.5 ${
                        suggested ? 'border-gold/40 bg-gold/[0.07]' : 'border-edge bg-black/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm text-neutral-200">{tx.description}</div>
                          <div className="text-[11px] text-neutral-500">
                            {shortDate(tx.date)}
                            {suggested && <span className="ml-1 text-gold">· ✨ match</span>}
                          </div>
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
                          onClick={() => applyTransaction(tx, 'PURCHASE')}
                          disabled={busy}
                          className="flex-1 rounded-lg border border-gold/40 bg-gold/10 px-2 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50"
                        >
                          Use as purchase
                        </button>
                        <button
                          onClick={() => applyTransaction(tx, 'SHIPPING')}
                          disabled={busy}
                          className="flex-1 rounded-lg border border-edge px-2 py-1.5 text-xs text-neutral-300 transition hover:border-gold/50 hover:text-gold disabled:opacity-50"
                        >
                          Use as shipping
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Manual entry fallback */}
          <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-neutral-600">
            <span className="h-px flex-1 bg-edge" />
            or enter manually
            <span className="h-px flex-1 bg-edge" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-xs text-neutral-500">
              Purchase cost (€)
              <input
                value={purchase}
                onChange={(e) => setPurchase(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="input mt-1"
              />
            </label>
            <label className="flex flex-col text-xs text-neutral-500">
              Shipping (€) <span className="text-neutral-600">optional</span>
              <input
                value={shipping}
                onChange={(e) => setShipping(e.target.value)}
                inputMode="decimal"
                placeholder="0.00"
                className="input mt-1"
              />
            </label>
          </div>

          {/* Live preview */}
          <div className="flex items-center justify-between rounded-lg border border-edge bg-black/30 p-3 text-sm">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Net profit</div>
              <div className={`text-lg font-semibold ${profit >= 0 ? 'text-status-stock' : 'text-red-400'}`}>
                {eur(profit)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">Margin</div>
              <div className={`text-lg font-semibold ${margin == null ? 'text-neutral-300' : margin >= 0 ? 'text-status-stock' : 'text-red-400'}`}>
                {pct(margin)}
              </div>
            </div>
          </div>

          {profit < 0 && canSave && (
            <p className="text-xs text-amber-400">
              ⚠ At this cost the item sold at a loss.
            </p>
          )}
          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-2">
            <button onClick={onClose} className="btn-ghost flex-1">
              Cancel
            </button>
            <button onClick={save} disabled={busy || !canSave} className="btn-gold flex-1">
              {busy ? 'Saving…' : 'Save cost'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
