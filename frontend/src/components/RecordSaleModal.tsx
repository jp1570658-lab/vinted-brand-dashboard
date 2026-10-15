import { useState } from 'react';
import type { Item } from '../api/types';
import { api } from '../api/endpoints';
import { eur } from '../lib/format';
import { totalCost } from '../lib/cost';
import { SALE_CHANNELS, PAYMENT_METHODS } from '../lib/channels';

interface Props {
  item: Item;
  onClose: () => void;
  /** Called after the sale is saved; receives the updated item. */
  onSold: (item: Item) => void;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Record a sale on any channel (Vinted, Depop, WhatsApp, pickup…): final price,
 * platform/payment fee as € or %, how the money arrived and optional outbound
 * shipping. Marks the item SOLD; the backend recomputes net profit.
 */
export function RecordSaleModal({ item, onClose, onSold }: Props) {
  const [channel, setChannel] = useState<string>('WhatsApp');
  const [price, setPrice] = useState(item.listedPrice != null ? String(item.listedPrice) : '');
  const [feeMode, setFeeMode] = useState<'EUR' | 'PCT'>('EUR');
  const [fee, setFee] = useState('');
  const [payment, setPayment] = useState<string>('Cash');
  const [shipping, setShipping] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNum = Number(price);
  const feeNum = Number(fee) || 0;
  const shippingNum = Number(shipping) || 0;
  const feeEur = round2(feeMode === 'PCT' ? (priceNum * feeNum) / 100 : feeNum);
  const valid =
    price.trim() !== '' &&
    priceNum > 0 &&
    feeNum >= 0 &&
    shippingNum >= 0 &&
    (feeMode === 'EUR' || feeNum <= 100);

  const profit = valid
    ? priceNum -
      totalCost({
        ...item,
        platformFee: feeEur,
        outboundShipping: shipping.trim() !== '' ? shippingNum : item.outboundShipping,
      })
    : null;

  async function save() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.items.update(item.id, {
        status: 'SOLD',
        salePrice: priceNum,
        platformFee: feeEur > 0 ? feeEur : null,
        ...(shipping.trim() !== '' ? { outboundShipping: shippingNum } : {}),
        saleChannel: channel,
        paymentMethod: payment,
      });
      onSold(updated);
    } catch (e: any) {
      setError(e?.message || 'Could not record the sale');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-edge bg-card p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-neutral-100">Record sale</h2>
            <p className="text-sm text-neutral-400">
              {item.brand} · {item.model}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Platform / channel">
            <div className="flex flex-wrap gap-1.5">
              {SALE_CHANNELS.map((c) => (
                <Chip key={c} active={channel === c} onClick={() => setChannel(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Final price sold (€)">
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              className="input w-full"
            />
          </Field>

          <Field label="Platform / payment fees">
            <div className="flex gap-2">
              <input
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                inputMode="decimal"
                placeholder="0"
                className="input flex-1"
              />
              <div className="flex overflow-hidden rounded-lg border border-edge">
                {(['EUR', 'PCT'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFeeMode(m)}
                    className={`px-3 text-sm ${
                      feeMode === m ? 'bg-gold/15 text-gold' : 'text-neutral-400'
                    }`}
                  >
                    {m === 'EUR' ? '€' : '%'}
                  </button>
                ))}
              </div>
            </div>
            <p className="mt-1 text-[11px] text-neutral-600">
              €0 for cash or an instant transfer.
              {feeMode === 'PCT' && feeNum > 0 && priceNum > 0 ? ` = ${eur(feeEur)}` : ''}
            </p>
          </Field>

          <Field label="Payment received via">
            <div className="flex flex-wrap gap-1.5">
              {PAYMENT_METHODS.map((m) => (
                <Chip key={m} active={payment === m} onClick={() => setPayment(m)}>
                  {m}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Outbound shipping you paid (€) — optional">
            <input
              value={shipping}
              onChange={(e) => setShipping(e.target.value)}
              inputMode="decimal"
              placeholder={item.outboundShipping != null ? String(item.outboundShipping) : '0.00'}
              className="input w-full"
            />
          </Field>

          {profit != null && (
            <div className="flex justify-between rounded-lg bg-black/30 p-3 text-sm">
              <span className="text-neutral-400">Net profit</span>
              <span className={profit >= 0 ? 'text-status-stock' : 'text-red-400'}>
                {eur(profit)}
              </span>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button disabled={!valid || busy} onClick={save} className="btn-gold w-full">
            {busy ? 'Saving…' : 'Mark as sold'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs text-neutral-500">{label}</div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active ? 'border-gold/50 bg-gold/15 text-gold' : 'border-edge text-neutral-400'
      }`}
    >
      {children}
    </button>
  );
}
