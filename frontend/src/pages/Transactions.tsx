import { useCallback, useEffect, useState } from 'react';
import type { Item, WiseTransaction } from '../api/types';
import { api } from '../api/endpoints';
import { TopNav } from '../components/TopNav';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { eur, money, shortDate } from '../lib/format';
import { useLayout } from '../hooks/useLayout';

const CATEGORY_STYLE: Record<string, string> = {
  SHIPPING: 'border-status-transit/40 bg-status-transit/15 text-status-transit',
  RUNNER_PAYMENT: 'border-status-sourced/40 bg-status-sourced/15 text-status-sourced',
  STOCK_PURCHASE: 'border-gold/40 bg-gold/15 text-gold',
  OTHER: 'border-edge bg-black/20 text-neutral-400',
};

export function Transactions() {
  const { refreshKey, onMenu } = useLayout();
  const [txns, setTxns] = useState<WiseTransaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.transactions.list({ limit: 200 }), api.items.list({ limit: 200 })])
      .then(([t, i]) => {
        setTxns(t.data);
        setItems(i.data);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function link(txId: string, itemId: string) {
    await api.transactions.update(txId, { itemId: itemId || null });
    setLinking(null);
    load();
  }

  return (
    <>
      <TopNav title="Transactions" onMenu={onMenu} />
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : txns.length === 0 ? (
          <EmptyState
            title="No transactions"
            message="Run a Wise sync from Settings to pull in expenses."
            icon="🧾"
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs uppercase text-neutral-500">
                  <th className="p-3">Date</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Amount</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Linked item</th>
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id} className="border-b border-edge/50 last:border-0">
                    <td className="p-3 text-neutral-400">{shortDate(t.date)}</td>
                    <td className="p-3 text-neutral-200">{t.description}</td>
                    <td className="p-3 text-neutral-300">
                      {money(t.amount, t.currency)}
                      {t.amountEur != null && (
                        <span className="ml-1 text-xs text-neutral-600">≈ {eur(t.amountEur)}</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          CATEGORY_STYLE[t.category || 'OTHER'] || CATEGORY_STYLE.OTHER
                        }`}
                      >
                        {t.category || 'OTHER'}
                      </span>
                    </td>
                    <td className="p-3">
                      {t.item ? (
                        <span className="text-neutral-300">
                          {t.item.brand} {t.item.model}
                        </span>
                      ) : linking === t.id ? (
                        <select
                          autoFocus
                          onChange={(e) => link(t.id, e.target.value)}
                          onBlur={() => setLinking(null)}
                          className="input py-1"
                          defaultValue=""
                        >
                          <option value="" disabled>
                            select item…
                          </option>
                          {items.map((i) => (
                            <option key={i.id} value={i.id}>
                              {i.brand} {i.model}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => setLinking(t.id)}
                          className="rounded border border-edge px-2 py-0.5 text-xs text-neutral-400 hover:border-gold/50 hover:text-gold"
                        >
                          Unlinked
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
