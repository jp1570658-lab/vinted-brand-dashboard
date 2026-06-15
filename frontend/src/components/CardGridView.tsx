import { useEffect, useState } from 'react';
import type { Item, ItemStatus } from '../api/types';
import { api } from '../api/endpoints';
import { ItemCard } from './ItemCard';
import { ItemDetailModal } from './ItemDetailModal';
import { CardGridSkeleton } from './Skeleton';
import { EmptyState } from './EmptyState';
import { TopNav } from './TopNav';
import { useLayout } from '../hooks/useLayout';

interface Props {
  title: string;
  status: ItemStatus;
  showAging?: boolean;
  showListed?: boolean;
  emptyMessage: string;
}

export function CardGridView({ title, status, showAging, showListed, emptyMessage }: Props) {
  const { refreshKey, bumpRefresh, openIntake, onMenu } = useLayout();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Item | null>(null);
  const [lastLoaded, setLastLoaded] = useState<string>('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.items
      .list({ status, limit: 200 })
      .then((res) => {
        if (!active) return;
        setItems(res.data);
        setLastLoaded(new Date().toISOString());
        setError(null);
      })
      .catch((e) => active && setError(e?.message || 'Failed to load'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [status, refreshKey]);

  return (
    <>
      <TopNav title={title} onMenu={onMenu} lastSynced={lastLoaded ? 'now' : undefined} />
      <div className="p-4">
        <div className="mb-3 text-xs text-neutral-500">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </div>

        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

        {loading ? (
          <CardGridSkeleton />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            message={emptyMessage}
            action={
              status === 'SOURCED' ? (
                <button onClick={openIntake} className="btn-gold">
                  + Quick Intake
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                showAging={showAging}
                showListed={showListed}
                onClick={setSelected}
              />
            ))}
          </div>
        )}
      </div>

      <ItemDetailModal item={selected} onClose={() => setSelected(null)} onChanged={bumpRefresh} />
    </>
  );
}
