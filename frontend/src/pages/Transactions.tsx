import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Item, WiseTransaction } from '../api/types';
import { api } from '../api/endpoints';
import { TopNav } from '../components/TopNav';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { LinkItemModal } from '../components/LinkItemModal';
import { eur, money, shortDate } from '../lib/format';
import { useLayout } from '../hooks/useLayout';

const CATEGORIES = [
  { key: 'SHIPPING', label: 'Shipping' },
  { key: 'RUNNER_PAYMENT', label: 'Runner' },
  { key: 'STOCK_PURCHASE', label: 'Stock' },
  { key: 'OTHER', label: 'Other' },
] as const;

const CATEGORY_STYLE: Record<string, string> = {
  SHIPPING: 'border-status-transit/40 bg-status-transit/15 text-status-transit',
  RUNNER_PAYMENT: 'border-status-sourced/40 bg-status-sourced/15 text-status-sourced',
  STOCK_PURCHASE: 'border-gold/40 bg-gold/15 text-gold',
  OTHER: 'border-edge bg-black/20 text-neutral-400',
};

const catLabel = (k: string | null | undefined) =>
  CATEGORIES.find((c) => c.key === k)?.label ?? 'Other';

function isThisMonth(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function Transactions() {
  const { refreshKey, onMenu } = useLayout();
  const [txns, setTxns] = useState<WiseTransaction[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [unlinkedOnly, setUnlinkedOnly] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [linkTx, setLinkTx] = useState<WiseTransaction | null>(null);

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

  const summary = useMemo(() => {
    let total = 0;
    let month = 0;
    let unlinked = 0;
    let other = 0;
    for (const t of txns) {
      const eurAmt = t.amountEur ?? t.amount;
      total += eurAmt;
      if (isThisMonth(t.date)) month += eurAmt;
      if (!t.item) unlinked += 1;
      if ((t.category || 'OTHER') === 'OTHER') other += 1;
    }
    return { total, month, unlinked, other };
  }, [txns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txns.filter((t) => {
      if (unlinkedOnly && t.item) return false;
      if (catFilter && (t.category || 'OTHER') !== catFilter) return false;
      if (q && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [txns, search, catFilter, unlinkedOnly]);

  async function changeCategory(id: string, category: string) {
    setEditingCat(null);
    setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, category } : t)));
    await api.transactions.update(id, { category });
  }

  async function unlink(id: string) {
    setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, item: null, itemId: null } : t)));
    await api.transactions.update(id, { itemId: null });
  }

  const filtersActive = Boolean(search || catFilter || unlinkedOnly);

  return (
    <>
      <TopNav title="Transactions" onMenu={onMenu} />
      <div className="space-y-4 p-4">
        {/* Spend summary */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <SummaryCard label="Total spent" value={eur(summary.total)} />
          <SummaryCard label="This month" value={eur(summary.month)} />
          <SummaryCard
            label="Unlinked"
            value={String(summary.unlinked)}
            active={unlinkedOnly}
            onClick={() => {
              setUnlinkedOnly((v) => !v);
              setCatFilter(null);
            }}
            accent={summary.unlinked > 0}
          />
          <SummaryCard
            label="Uncategorised"
            value={String(summary.other)}
            active={catFilter === 'OTHER'}
            onClick={() => {
              setCatFilter((v) => (v === 'OTHER' ? null : 'OTHER'));
              setUnlinkedOnly(false);
            }}
            accent={summary.other > 0}
          />
        </div>

        {/* Search + filters */}
        <div className="space-y-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description…"
            className="input w-full"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <FilterChip label="All" active={!catFilter} onClick={() => setCatFilter(null)} />
            {CATEGORIES.map((c) => (
              <FilterChip
                key={c.key}
                label={c.label}
                active={catFilter === c.key}
                onClick={() => setCatFilter((v) => (v === c.key ? null : c.key))}
              />
            ))}
            <button
              onClick={() => setUnlinkedOnly((v) => !v)}
              className={`ml-auto rounded-full border px-3 py-1 text-xs transition ${
                unlinkedOnly
                  ? 'border-gold/50 bg-gold/15 text-gold'
                  : 'border-edge text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Unlinked only
            </button>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : txns.length === 0 ? (
          <EmptyState
            title="No transactions"
            message="Run a Wise sync from Settings to pull in expenses."
            icon="🧾"
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            message="Try clearing filters or search."
            icon="🔍"
          />
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span>
                {filtered.length} of {txns.length}
              </span>
              {filtersActive && (
                <button
                  onClick={() => {
                    setSearch('');
                    setCatFilter(null);
                    setUnlinkedOnly(false);
                  }}
                  className="text-neutral-400 hover:text-gold"
                >
                  Clear filters
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {filtered.map((t) => {
                const eurAmt = t.amountEur ?? t.amount;
                const showRaw = t.currency !== 'EUR';
                return (
                  <li
                    key={t.id}
                    className="flex flex-col gap-2 rounded-xl border border-edge bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    {/* Left: date, description, category */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-neutral-500">{shortDate(t.date)}</span>
                        {editingCat === t.id ? (
                          <select
                            autoFocus
                            defaultValue={t.category || 'OTHER'}
                            onBlur={() => setEditingCat(null)}
                            onChange={(e) => changeCategory(t.id, e.target.value)}
                            className="input py-0.5 text-xs"
                          >
                            {CATEGORIES.map((c) => (
                              <option key={c.key} value={c.key}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingCat(t.id)}
                            title="Change category"
                            className={`rounded-full border px-2 py-0.5 text-[10px] transition hover:brightness-125 ${
                              CATEGORY_STYLE[t.category || 'OTHER'] || CATEGORY_STYLE.OTHER
                            }`}
                          >
                            {catLabel(t.category)} ▾
                          </button>
                        )}
                      </div>
                      <div className="mt-1 truncate text-sm text-neutral-200">{t.description}</div>
                    </div>

                    {/* Right: amount + link */}
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="text-right">
                        <div className="text-sm font-semibold text-neutral-100">{eur(eurAmt)}</div>
                        {showRaw && (
                          <div className="text-[11px] text-neutral-600">
                            {money(t.amount, t.currency)}
                          </div>
                        )}
                      </div>
                      {t.item ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-2 py-1 text-xs text-gold">
                          <button
                            onClick={() => setLinkTx(t)}
                            className="max-w-[120px] truncate hover:underline"
                            title="Change linked item"
                          >
                            {t.item.brand} {t.item.model}
                          </button>
                          <button
                            onClick={() => unlink(t.id)}
                            title="Unlink"
                            className="text-gold/60 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => setLinkTx(t)}
                          className="shrink-0 rounded-lg border border-edge px-3 py-1.5 text-xs text-neutral-300 hover:border-gold/50 hover:text-gold"
                        >
                          + Link item
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {linkTx && (
        <LinkItemModal
          tx={linkTx}
          items={items}
          onClose={() => setLinkTx(null)}
          onDone={() => {
            setLinkTx(null);
            load();
          }}
        />
      )}
    </>
  );
}

function SummaryCard({
  label,
  value,
  onClick,
  active,
  accent,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  active?: boolean;
  accent?: boolean;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`rounded-xl border bg-card p-3 text-left transition ${
        active ? 'border-gold' : 'border-edge'
      } ${onClick ? 'hover:border-gold/50' : ''}`}
    >
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div
        className={`mt-1 text-lg font-semibold ${
          accent && !active ? 'text-neutral-100' : active ? 'text-gold' : 'text-neutral-100'
        }`}
      >
        {value}
      </div>
    </Tag>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active
          ? 'border-gold/50 bg-gold/15 text-gold'
          : 'border-edge text-neutral-400 hover:text-neutral-200'
      }`}
    >
      {label}
    </button>
  );
}
