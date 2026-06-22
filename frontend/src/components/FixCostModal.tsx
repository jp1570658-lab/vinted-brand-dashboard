import { useState } from 'react';
import type { Item } from '../api/types';
import { api } from '../api/endpoints';
import { eur, pct } from '../lib/format';
import { ItemImage } from './ItemImage';

interface Props {
  item: Item | null;
  onClose: () => void;
  onChanged: () => void;
}

/**
 * Quick "fix cost" shortcut for a sold item that has no recorded cost.
 * Sets purchase (+ optional shipping) in EUR and lets the backend recompute
 * netProfit. Shows a live profit/margin preview before saving.
 */
export function FixCostModal({ item, onClose, onChanged }: Props) {
  const [purchase, setPurchase] = useState('');
  const [shipping, setShipping] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) return null;

  const sale = item.salePrice ?? 0;
  const purchaseNum = Number(purchase) || 0;
  const shippingNum = Number(shipping) || 0;
  const customs = item.customsFees ?? 0;
  const cost = purchaseNum + shippingNum + customs;
  const profit = sale - cost;
  const margin = sale > 0 ? (profit / sale) * 100 : null;
  const canSave = purchase.trim() !== '' && Number.isFinite(purchaseNum) && purchaseNum >= 0;

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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl border border-edge bg-card sm:rounded-2xl">
        <div className="flex items-center gap-3 border-b border-edge p-4">
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

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col text-xs text-neutral-500">
              Purchase cost (€)
              <input
                autoFocus
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
