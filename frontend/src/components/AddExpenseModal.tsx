import { useState } from 'react';
import { api } from '../api/endpoints';
import { eur } from '../lib/format';
import { CATEGORIES, SOURCES } from '../lib/expenses';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const CURRENCIES = ['EUR', 'GBP', 'NGN', 'KES'] as const;
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Add an expense that didn't come through the Wise sync: a Western Union
 * transfer to a runner, a cash freight payment, packing or cleaning supplies…
 * The transfer fee is kept separately so the accounting journal can show it, and
 * it's included when the expense is split across a batch of bags.
 */
export function AddExpenseModal({ onClose, onCreated }: Props) {
  const [source, setSource] = useState<string>('WESTERN_UNION');
  const [category, setCategory] = useState<string>('STOCK_PURCHASE');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string>('EUR');
  const [fee, setFee] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount);
  const feeNum = Number(fee) || 0;
  const valid =
    description.trim() !== '' && amountNum > 0 && date !== '' && (fee.trim() === '' || feeNum >= 0);

  async function save() {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await api.transactions.create({
        date,
        description: description.trim(),
        amount: amountNum,
        currency,
        source,
        category,
        fee: fee.trim() !== '' ? feeNum : null,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Could not add the expense');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-edge bg-card p-5 sm:rounded-2xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-neutral-100">Add expense</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-200">
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Paid via">
            <Chips options={SOURCES} value={source} onChange={setSource} />
          </Field>

          <Field label="Category">
            <Chips options={CATEGORIES} value={category} onChange={setCategory} />
          </Field>

          <Field label="Description">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. WU to Ada — 3 bags, MTCN 123…"
              className="input w-full"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input w-full"
              />
            </Field>
            <Field label="Amount sent">
              <div className="flex gap-1">
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="input min-w-0 flex-1"
                />
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="input w-[72px] px-1"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </Field>
          </div>

          <Field label="Transfer fee (€) — optional">
            <input
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              inputMode="decimal"
              placeholder="e.g. 3.90"
              className="input w-full"
            />
            <p className="mt-1 text-[11px] text-neutral-600">
              Counted in the expense total — splitting it across bags spreads the fee into each bag's
              cost.
              {currency === 'EUR' && amountNum > 0 && feeNum > 0
                ? ` Total ${eur(amountNum + feeNum)}.`
                : ''}
            </p>
          </Field>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button disabled={!valid || busy} onClick={save} className="btn-gold w-full">
            {busy ? 'Saving…' : 'Add expense'}
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

function Chips({
  options,
  value,
  onChange,
}: {
  options: readonly { key: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={`rounded-full border px-3 py-1.5 text-xs transition ${
            value === o.key ? 'border-gold/50 bg-gold/15 text-gold' : 'border-edge text-neutral-400'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
