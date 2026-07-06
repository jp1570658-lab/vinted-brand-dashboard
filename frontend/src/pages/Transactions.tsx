import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Item, WiseTransaction } from '../api/types';
import { api } from '../api/endpoints';
import { TopNav } from '../components/TopNav';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { LinkItemModal } from '../components/LinkItemModal';
import { SplitItemModal } from '../components/SplitItemModal';
import { QuickIntakeModal } from '../components/QuickIntakeModal';
import { eur, money, shortDate } from '../lib/format';
import { soldNeedsCost } from '../lib/cost';
import { isUnlinked } from '../lib/tx';
import { suggestItems, runnerNamesOf, SUGGEST_THRESHOLD, type Suggestion } from '../lib/matchItem';
import { useLayout } from '../hooks/useLayout';

type ApplyAs = 'PURCHASE' | 'SHIPPING';

/** A payment that confidently matches a SOLD item still missing its cost. */
interface ReconcileTarget {
  item: Item;
  applyAs: ApplyAs;
}

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
  const [reconcileOnly, setReconcileOnly] = useState(false);
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [linkTx, setLinkTx] = useState<WiseTransaction | null>(null);
  const [splitTx, setSplitTx] = useState<WiseTransaction | null>(null);
  const [createTx, setCreateTx] = useState<WiseTransaction | null>(null);

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
      const linked = !isUnlinked(t);
      total += eurAmt;
      if (isThisMonth(t.date)) month += eurAmt;
      if (!linked) unlinked += 1;
      if ((t.category || 'OTHER') === 'OTHER') other += 1;
    }
    return { total, month, unlinked, other };
  }, [txns]);

  // Top confident match per unlinked transaction (for one-tap linking).
  const suggestions = useMemo(() => {
    const names = runnerNamesOf(items);
    const map = new Map<string, Suggestion>();
    for (const t of txns) {
      if (!isUnlinked(t)) continue;
      const top = suggestItems(t, items, names)[0];
      if (top && top.score >= SUGGEST_THRESHOLD) map.set(t.id, top);
    }
    return map;
  }, [txns, items]);

  // Unlinked payments whose confident match is a SOLD item still missing its cost:
  // linking these can fix the item's (overstated) profit in one tap. The payment's
  // category picks how to apply it — shipping payments as shipping, everything else
  // as the purchase cost.
  const reconcileTargets = useMemo(() => {
    const map = new Map<string, ReconcileTarget>();
    suggestions.forEach((sug, txId) => {
      if (!soldNeedsCost(sug.item)) return;
      const tx = txns.find((t) => t.id === txId);
      const applyAs: ApplyAs = tx?.category === 'SHIPPING' ? 'SHIPPING' : 'PURCHASE';
      map.set(txId, { item: sug.item, applyAs });
    });
    return map;
  }, [suggestions, txns]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return txns.filter((t) => {
      if (reconcileOnly && !reconcileTargets.has(t.id)) return false;
      if (unlinkedOnly && !isUnlinked(t)) return false;
      if (catFilter && (t.category || 'OTHER') !== catFilter) return false;
      if (q && !t.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [txns, search, catFilter, unlinkedOnly, reconcileOnly, reconcileTargets]);

  async function acceptSuggestion(txId: string, item: Item) {
    setTxns((prev) =>
      prev.map((t) =>
        t.id === txId
          ? { ...t, item: { id: item.id, brand: item.brand, model: item.model }, itemId: item.id }
          : t,
      ),
    );
    await api.transactions.update(txId, { itemId: item.id });
  }

  // Link the payment to the sold item AND set it as that item's cost, fixing the
  // overstated profit. Reload afterwards so the item's cost state (and this list of
  // reconcile targets) reflects the change.
  async function reconcile(txId: string, target: ReconcileTarget) {
    const { item, applyAs } = target;
    setTxns((prev) =>
      prev.map((t) =>
        t.id === txId
          ? { ...t, item: { id: item.id, brand: item.brand, model: item.model }, itemId: item.id }
          : t,
      ),
    );
    await api.transactions.update(txId, { itemId: item.id, applyAs });
    load();
  }

  async function changeCategory(id: string, category: string) {
    setEditingCat(null);
    setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, category } : t)));
    await api.transactions.update(id, { category });
  }

  async function unlink(id: string) {
    setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, item: null, itemId: null } : t)));
    await api.transactions.update(id, { itemId: null });
  }

  async function unsplit(id: string) {
    setTxns((prev) => prev.map((t) => (t.id === id ? { ...t, splits: [] } : t)));
    await api.transactions.unsplit(id);
    load();
  }

  const filtersActive = Boolean(search || catFilter || unlinkedOnly || reconcileOnly);

  function toggleReconcile() {
    setReconcileOnly((v) => !v);
    setUnlinkedOnly(false);
    setCatFilter(null);
  }

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

        {/* Reconcile insight — unlinked payments that can fix a sold item's cost */}
        {reconcileTargets.size > 0 && (
          <button
            onClick={toggleReconcile}
            className={`flex w-full items-center gap-2 rounded-xl border p-3 text-left text-sm transition ${
              reconcileOnly
                ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:border-amber-500/50'
            }`}
          >
            <span>⚙</span>
            <span className="flex-1">
              {reconcileTargets.size} unlinked{' '}
              {reconcileTargets.size === 1 ? 'payment matches a sold item' : 'payments match sold items'}{' '}
              missing cost — tap to {reconcileOnly ? 'show all' : 'review & apply'}.
            </span>
            {reconcileOnly && <span className="text-xs text-amber-300/70">showing these ✕</span>}
          </button>
        )}

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
                    setReconcileOnly(false);
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
                const target = reconcileTargets.get(t.id);
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
                      {t.splits && t.splits.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {t.splits.map((s) => (
                            <span
                              key={s.id}
                              className="rounded border border-edge bg-black/20 px-1.5 py-0.5 text-[10px] text-neutral-400"
                            >
                              {s.item ? `${s.item.brand} ${s.item.model}` : 'item'} ·{' '}
                              <span className="text-gold">{eur(s.amount)}</span>
                            </span>
                          ))}
                        </div>
                      )}
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
                      {t.splits && t.splits.length > 0 ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => setSplitTx(t)}
                            title="Edit split"
                            className="inline-flex items-center gap-1 rounded-lg border border-gold/40 bg-gold/10 px-2.5 py-1.5 text-xs font-medium text-gold hover:bg-gold/20"
                          >
                            ⊟ Split · {t.splits.length}
                          </button>
                          <button
                            onClick={() => unsplit(t.id)}
                            title="Remove split"
                            className="rounded-lg border border-edge px-2 py-1.5 text-xs text-neutral-400 hover:border-red-400/50 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                      ) : t.item ? (
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
                      ) : target ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => reconcile(t.id, target)}
                            title={`Link and set ${eur(eurAmt)} as ${target.item.brand}'s ${
                              target.applyAs === 'SHIPPING' ? 'shipping' : 'purchase'
                            } cost — fixes its profit`}
                            className="inline-flex max-w-[190px] items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/25"
                          >
                            <span>⚙</span>
                            <span className="truncate">
                              Fix {target.item.brand} · {target.applyAs === 'SHIPPING' ? 'shipping' : 'purchase'}
                            </span>
                          </button>
                          <button
                            onClick={() => setLinkTx(t)}
                            title="Pick a different item or cost type"
                            className="rounded-lg border border-edge px-2 py-1.5 text-xs text-neutral-400 hover:border-gold/50 hover:text-gold"
                          >
                            ⋯
                          </button>
                          <button
                            onClick={() => setSplitTx(t)}
                            title="Split across items"
                            className="rounded-lg border border-edge px-2 py-1.5 text-xs text-neutral-400 hover:border-gold/50 hover:text-gold"
                          >
                            ⊟
                          </button>
                        </div>
                      ) : suggestions.has(t.id) ? (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => acceptSuggestion(t.id, suggestions.get(t.id)!.item)}
                            title={`Suggested · ${suggestions.get(t.id)!.reason}`}
                            className="inline-flex max-w-[150px] items-center gap-1 rounded-lg border border-gold/50 bg-gold/15 px-2.5 py-1.5 text-xs font-medium text-gold hover:bg-gold/25"
                          >
                            <span>✨</span>
                            <span className="truncate">
                              {suggestions.get(t.id)!.item.brand} {suggestions.get(t.id)!.item.model}
                            </span>
                          </button>
                          <button
                            onClick={() => setLinkTx(t)}
                            title="Pick a different item"
                            className="rounded-lg border border-edge px-2 py-1.5 text-xs text-neutral-400 hover:border-gold/50 hover:text-gold"
                          >
                            ⋯
                          </button>
                          <button
                            onClick={() => setSplitTx(t)}
                            title="Split across items"
                            className="rounded-lg border border-edge px-2 py-1.5 text-xs text-neutral-400 hover:border-gold/50 hover:text-gold"
                          >
                            ⊟
                          </button>
                        </div>
                      ) : (
                        <div className="flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => setLinkTx(t)}
                            className="rounded-lg border border-edge px-3 py-1.5 text-xs text-neutral-300 hover:border-gold/50 hover:text-gold"
                          >
                            + Link item
                          </button>
                          <button
                            onClick={() => setSplitTx(t)}
                            title="Split across items"
                            className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-neutral-400 hover:border-gold/50 hover:text-gold"
                          >
                            ⊟ Split
                          </button>
                        </div>
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
          onCreateNew={() => {
            setCreateTx(linkTx);
            setLinkTx(null);
          }}
        />
      )}

      {createTx && (
        <QuickIntakeModal
          open
          linkTxId={createTx.id}
          prefill={{ price: String(createTx.amountEur ?? createTx.amount), currency: 'EUR' }}
          onClose={() => setCreateTx(null)}
          onCreated={load}
        />
      )}

      {splitTx && (
        <SplitItemModal
          tx={splitTx}
          items={items}
          onClose={() => setSplitTx(null)}
          onDone={() => {
            setSplitTx(null);
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
