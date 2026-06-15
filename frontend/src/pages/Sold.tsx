import { useEffect, useState } from 'react';
import type { Item } from '../api/types';
import { api } from '../api/endpoints';
import { TopNav } from '../components/TopNav';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { eur, money, pct, shortDate } from '../lib/format';
import { useLayout } from '../hooks/useLayout';

export function Sold() {
  const { refreshKey, onMenu } = useLayout();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.items
      .list({ status: 'SOLD', limit: 200 })
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <>
      <TopNav title="Sold" onMenu={onMenu} />
      <div className="p-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="No sales yet" message="Sold bags and their profit will appear here." icon="💰" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-edge">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs uppercase text-neutral-500">
                  <th className="p-3">Item</th>
                  <th className="p-3">Sale</th>
                  <th className="p-3">Cost (EUR)</th>
                  <th className="p-3">Net profit</th>
                  <th className="p-3">Margin</th>
                  <th className="p-3">Sold</th>
                  <th className="p-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b border-edge/50 last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {it.photoUrl ? (
                          <img src={it.photoUrl} alt="" loading="lazy" className="h-9 w-9 rounded object-cover" />
                        ) : (
                          <div className="flex h-9 w-9 items-center justify-center rounded bg-black/30">👜</div>
                        )}
                        <div>
                          <div className="font-medium text-neutral-100">{it.brand}</div>
                          <div className="text-xs text-neutral-500">{it.model}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-neutral-200">{eur(it.salePrice)}</td>
                    <td className="p-3 text-neutral-400">{money(it.purchasePrice, it.purchaseCurrency)}</td>
                    <td className={`p-3 font-semibold ${(it.netProfit ?? 0) >= 0 ? 'text-status-stock' : 'text-red-400'}`}>
                      {eur(it.netProfit)}
                    </td>
                    <td className="p-3 text-neutral-400">{pct(it.marginPct)}</td>
                    <td className="p-3 text-neutral-400">{shortDate(it.soldAt)}</td>
                    <td className="p-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] ${
                          it.saleSource === 'AUTO_GMAIL'
                            ? 'border-status-stock/40 bg-status-stock/15 text-status-stock'
                            : 'border-edge bg-black/20 text-neutral-400'
                        }`}
                      >
                        {it.saleSource === 'AUTO_GMAIL' ? 'Auto' : 'Manual'}
                      </span>
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
