import { useState } from 'react';
import type { Item, ItemStatus } from '../api/types';
import { api } from '../api/endpoints';
import { eur, money, shortDate } from '../lib/format';
import { STATUS_ORDER, STATUS_LABEL } from '../lib/status';
import { StatusBadge } from './StatusBadge';

interface Props {
  item: Item | null;
  onClose: () => void;
  onChanged: () => void;
}

// The next status in the lifecycle (null if already SOLD).
function nextStatus(s: ItemStatus): ItemStatus | null {
  const i = STATUS_ORDER.indexOf(s);
  return i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null;
}

export function ItemDetailModal({ item, onClose, onChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listed, setListed] = useState('');
  const [sale, setSale] = useState('');

  if (!item) return null;
  const advance = nextStatus(item.status);

  async function patch(patch: Partial<Item> & { status?: ItemStatus }) {
    if (!item) return;
    setBusy(true);
    setError(null);
    try {
      await api.items.update(item.id, patch);
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item) return;
    if (!confirm('Delete this item? It will be hidden from all views.')) return;
    setBusy(true);
    try {
      await api.items.remove(item.id);
      onChanged();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-edge bg-card sm:rounded-2xl">
        {item.photoUrl ? (
          <img src={item.photoUrl} alt="" className="h-48 w-full object-cover" />
        ) : (
          <div className="flex h-32 items-center justify-center bg-black/30 text-4xl">👜</div>
        )}
        <div className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">{item.brand}</h2>
              <p className="text-sm text-neutral-400">
                {item.model}
                {item.color ? ` · ${item.color}` : ''}
                {item.grade ? ` · Grade ${item.grade}` : ''}
              </p>
            </div>
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
              ✕
            </button>
          </div>

          <div className="mt-3"><StatusBadge status={item.status} /></div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <Row label="Purchase" value={money(item.purchasePrice, item.purchaseCurrency)} />
            <Row label="≈ EUR" value={eur(item.purchasePriceEur)} />
            <Row label="Runner" value={item.runner?.name ?? '—'} />
            <Row label="Sourced" value={shortDate(item.sourcedAt)} />
            {item.listedPrice != null && <Row label="Listed" value={eur(item.listedPrice)} />}
            {item.salePrice != null && <Row label="Sold for" value={eur(item.salePrice)} />}
            {item.netProfit != null && (
              <Row
                label="Net profit"
                value={
                  <span className={item.netProfit >= 0 ? 'text-status-stock' : 'text-red-400'}>
                    {eur(item.netProfit)} {item.marginPct != null ? `(${item.marginPct}%)` : ''}
                  </span>
                }
              />
            )}
            {item.saleSource && <Row label="Sale source" value={item.saleSource} />}
          </dl>

          {item.notes && (
            <p className="mt-3 rounded-lg bg-black/30 p-3 text-sm text-neutral-400">{item.notes}</p>
          )}

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

          {/* In-stock quick price edit */}
          {item.status === 'IN_STOCK' && (
            <div className="mt-4 flex gap-2">
              <input
                value={listed}
                onChange={(e) => setListed(e.target.value)}
                inputMode="decimal"
                placeholder={item.listedPrice ? String(item.listedPrice) : 'Listed €'}
                className="input flex-1"
              />
              <button
                disabled={busy || !listed}
                onClick={() => patch({ listedPrice: Number(listed) })}
                className="btn-ghost"
              >
                Set price
              </button>
            </div>
          )}

          {/* Advance status */}
          <div className="mt-4 flex flex-wrap gap-2">
            {advance && advance !== 'SOLD' && (
              <button disabled={busy} onClick={() => patch({ status: advance })} className="btn-gold">
                → {STATUS_LABEL[advance]}
              </button>
            )}
            {item.status === 'IN_STOCK' && (
              <div className="flex w-full gap-2">
                <input
                  value={sale}
                  onChange={(e) => setSale(e.target.value)}
                  inputMode="decimal"
                  placeholder="Sale price €"
                  className="input flex-1"
                />
                <button
                  disabled={busy || !sale}
                  onClick={() => patch({ status: 'SOLD', salePrice: Number(sale) })}
                  className="btn-gold"
                >
                  Mark Sold
                </button>
              </div>
            )}
            <button disabled={busy} onClick={remove} className="btn-ghost text-red-400">
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="text-neutral-200">{value}</dd>
    </div>
  );
}
