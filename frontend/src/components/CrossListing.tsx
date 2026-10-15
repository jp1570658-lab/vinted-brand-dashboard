import { useState } from 'react';
import type { Item } from '../api/types';
import { api } from '../api/endpoints';
import { SALE_CHANNELS, delistMessage } from '../lib/channels';

/**
 * "Listed on" chips — tick every platform the bag is advertised on. Saves on each
 * tap (no submit) so the cross-listing reminder knows where to delist after a sale.
 */
export function ListedOnPicker({ item, onChanged }: { item: Item; onChanged: () => void }) {
  const [listed, setListed] = useState<string[]>(item.listedOn ?? []);
  const [error, setError] = useState<string | null>(null);

  async function toggle(channel: string) {
    const prev = listed;
    const next = prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel];
    setListed(next);
    setError(null);
    try {
      await api.items.update(item.id, { listedOn: next });
      onChanged();
    } catch (e: any) {
      setListed(prev);
      setError(e?.message || 'Could not save');
    }
  }

  return (
    <div className="mt-4">
      <div className="mb-1 text-xs text-neutral-500">Listed on</div>
      <div className="flex flex-wrap gap-1.5">
        {SALE_CHANNELS.filter((c) => c !== 'Direct Pickup').map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggle(c)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              listed.includes(c) ? 'border-gold/50 bg-gold/15 text-gold' : 'border-edge text-neutral-500'
            }`}
          >
            {listed.includes(c) ? '✓ ' : ''}
            {c}
          </button>
        ))}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

/**
 * Cross-listing reminder for a SOLD bag still advertised elsewhere. "Done" keeps
 * only the channel it sold on, which clears the reminder everywhere.
 */
export function DelistReminder({
  item,
  onDone,
}: {
  item: Pick<Item, 'id' | 'saleChannel' | 'delistOn'>;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = item.delistOn ?? [];
  if (pending.length === 0) return null;

  async function done() {
    setBusy(true);
    setError(null);
    try {
      await api.items.update(item.id, { listedOn: item.saleChannel ? [item.saleChannel] : [] });
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Could not save');
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
      <p className="text-sm text-amber-200">⚠️ {delistMessage(pending)}</p>
      <button
        type="button"
        disabled={busy}
        onClick={done}
        className="mt-2 rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/20"
      >
        {busy ? 'Saving…' : '✓ Done — removed everywhere'}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
