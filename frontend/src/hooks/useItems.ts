import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/endpoints';
import type { Item, ItemStatus, Pagination } from '../api/types';

interface UseItemsResult {
  items: Item[];
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useItems(params: Record<string, string | number | undefined> = {}): UseItemsResult {
  const [items, setItems] = useState<Item[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.items.list(JSON.parse(key));
      setItems(res.data);
      setPagination(res.pagination);
    } catch (e: any) {
      setError(e?.message || 'Failed to load items');
    } finally {
      setLoading(false);
    }
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, pagination, loading, error, reload: load };
}

export function useItemsByStatus(status: ItemStatus) {
  return useItems({ status, limit: 200 });
}
