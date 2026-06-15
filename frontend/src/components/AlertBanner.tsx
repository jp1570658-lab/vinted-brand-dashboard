import { useEffect, useState } from 'react';
import { useItemsByStatus } from '../hooks/useItems';
import { isAged } from './AgingBadge';

const DISMISS_KEY = 'aging-banner-dismissed';

/** Dismissible banner shown when any SOURCED item is over 14 days old. */
export function AlertBanner() {
  const { items } = useItemsByStatus('SOURCED');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
  }, []);

  const stuck = items.filter((i) => isAged(i.sourcedAt));
  if (dismissed || stuck.length === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
      <span>
        ⚠️ <strong>{stuck.length}</strong> bag{stuck.length > 1 ? 's have' : ' has'} been stuck
        abroad for over 14 days
      </span>
      <button
        onClick={() => {
          sessionStorage.setItem(DISMISS_KEY, '1');
          setDismissed(true);
        }}
        className="shrink-0 rounded px-2 py-0.5 text-red-300 hover:bg-red-500/20"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
