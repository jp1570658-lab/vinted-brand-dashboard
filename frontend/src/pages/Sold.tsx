import { useEffect, useMemo, useState } from 'react';
import type { Item } from '../api/types';
import { api } from '../api/endpoints';
import { TopNav } from '../components/TopNav';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { ItemImage } from '../components/ItemImage';
import { ItemDetailModal } from '../components/ItemDetailModal';
import { FixCostModal } from '../components/FixCostModal';
import { eur, money, pct, shortDate, daysBetween } from '../lib/format';
import { useLayout } from '../hooks/useLayout';

// Sales analysis is anchored to the start of June 2026.
// (Older imported listings carry no real sale date — see "undated" section.)
const SOLD_DATA_START = '2026-06-01';

type SortKey = 'soldAt' | 'profit' | 'margin' | 'salePrice' | 'speed';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'soldAt', label: 'Newest sold' },
  { key: 'profit', label: 'Most profit' },
  { key: 'margin', label: 'Best margin' },
  { key: 'salePrice', label: 'Highest sale' },
  { key: 'speed', label: 'Fastest sold' },
];

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Total landed cost of an item in EUR (purchase + shipping + customs). */
function totalCost(it: Item): number {
  return (it.purchasePriceEur ?? 0) + (it.shippingCost ?? 0) + (it.customsFees ?? 0);
}

/** Realised profit — prefer the stored netProfit, else derive from sale − cost. */
function profitOf(it: Item): number {
  if (it.netProfit != null) return it.netProfit;
  if (it.salePrice != null) return it.salePrice - totalCost(it);
  return 0;
}


/** No purchase/shipping/customs cost recorded → profit & margin are overstated. */
function costMissing(it: Item): boolean {
  return totalCost(it) <= 0;
}

/** Best available "listed / posted" date — when the item went in-stock. */
function listedDate(it: Item): string | null {
  return it.stockAt ?? it.sourcedAt ?? it.createdAt ?? null;
}

/** Days the item sat listed before selling. */
function daysListed(it: Item): number | null {
  return daysBetween(listedDate(it), it.soldAt);
}

function isAutoSale(it: Item): boolean {
  return it.saleSource === 'AUTO_GMAIL' || it.saleSource === 'AUTO_VINTED';
}

type Health = 'all' | 'profit' | 'loss' | 'nocost';

const HEALTH_LABEL: Record<Health, string> = {
  all: 'All',
  profit: '✅ Profit',
  loss: '🔴 Loss',
  nocost: '⚠ Needs cost',
};

export function Sold() {
  const { refreshKey, bumpRefresh, onMenu } = useLayout();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);
  const [fixItem, setFixItem] = useState<Item | null>(null);

  // Filters
  type Preset = 'start' | 7 | 30 | 'all';
  const [from, setFrom] = useState(SOLD_DATA_START);
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('soldAt');
  const [health, setHealth] = useState<Health>('all');
  const [brand, setBrand] = useState('');
  const [source, setSource] = useState<'all' | 'auto' | 'manual'>('all');
  const [showUndated, setShowUndated] = useState(false);
  const [activePreset, setActivePreset] = useState<Preset | null>('start');

  useEffect(() => {
    setLoading(true);
    api.items
      .list({ status: 'SOLD', limit: 200 })
      .then((res) => setItems(res.data))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // All brands that have a sale — powers the brand dropdown.
  const brands = useMemo(
    () => Array.from(new Set(items.map((i) => i.brand))).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  // Every non-date facet (search + brand + source) in one predicate, so all
  // filters apply consistently to KPIs, counts, the list AND the imported section.
  const matchesFacets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (it: Item) => {
      if (q && !`${it.brand} ${it.model} ${it.color ?? ''} ${it.runner?.name ?? ''}`.toLowerCase().includes(q))
        return false;
      if (brand && it.brand !== brand) return false;
      if (source === 'auto' && !isAutoSale(it)) return false;
      if (source === 'manual' && isAutoSale(it)) return false;
      return true;
    };
  }, [search, brand, source]);

  // Dated, in-window sales that pass every facet — the analysis set.
  const scoped = useMemo(() => {
    const fromMs = from ? new Date(from).getTime() : -Infinity;
    const toMs = to ? new Date(`${to}T23:59:59`).getTime() : Infinity;
    return items
      .filter((it) => it.soldAt != null)
      .filter((it) => {
        const t = new Date(it.soldAt as string).getTime();
        return t >= fromMs && t <= toMs;
      })
      .filter(matchesFacets);
  }, [items, from, to, matchesFacets]);

  // Imported sales with no real sale date — kept out of the period maths, shown separately.
  const undated = useMemo(
    () => items.filter((it) => it.soldAt == null).filter(matchesFacets),
    [items, matchesFacets],
  );

  // Profit-health breakdown (drives the insights banner + filter chips) — pre-health so
  // every bucket's count stays visible to pick from.
  const health$ = useMemo(() => {
    const loss = scoped.filter((it) => profitOf(it) < 0);
    const nocost = scoped.filter(costMissing);
    const profit = scoped.filter((it) => profitOf(it) >= 0 && !costMissing(it));
    const lossTotal = loss.reduce((s, it) => s + profitOf(it), 0);
    return {
      counts: { all: scoped.length, profit: profit.length, loss: loss.length, nocost: nocost.length },
      lossTotal,
    };
  }, [scoped]);

  // Visible list = scoped + active health filter, sorted.
  const sorted = useMemo(() => {
    const arr = scoped.filter((it) => {
      switch (health) {
        case 'profit':
          return profitOf(it) >= 0 && !costMissing(it);
        case 'loss':
          return profitOf(it) < 0;
        case 'nocost':
          return costMissing(it);
        case 'all':
        default:
          return true;
      }
    });
    arr.sort((a, b) => {
      switch (sort) {
        case 'profit':
          return profitOf(b) - profitOf(a);
        case 'margin':
          return (b.marginPct ?? -Infinity) - (a.marginPct ?? -Infinity);
        case 'salePrice':
          return (b.salePrice ?? 0) - (a.salePrice ?? 0);
        case 'speed':
          return (daysListed(a) ?? Infinity) - (daysListed(b) ?? Infinity);
        case 'soldAt':
        default:
          return new Date(b.soldAt as string).getTime() - new Date(a.soldAt as string).getTime();
      }
    });
    return arr;
  }, [scoped, sort, health]);

  // KPIs reflect exactly what's visible, so the headline always matches the filters.
  const k = useMemo(() => {
    const units = sorted.length;
    const revenue = sorted.reduce((s, it) => s + (it.salePrice ?? 0), 0);
    const cost = sorted.reduce((s, it) => s + totalCost(it), 0);
    const profit = sorted.reduce((s, it) => s + profitOf(it), 0);
    const speeds = sorted.map(daysListed).filter((d): d is number => d != null);
    const avgSpeed = speeds.length ? speeds.reduce((s, d) => s + d, 0) / speeds.length : null;
    const best = sorted.reduce<Item | null>(
      (acc, it) => (acc == null || profitOf(it) > profitOf(acc) ? it : acc),
      null,
    );
    return {
      units,
      revenue,
      cost,
      profit,
      margin: revenue > 0 ? (profit / revenue) * 100 : null,
      avgSpeed,
      best,
    };
  }, [sorted]);

  const filtersActive =
    activePreset !== 'start' || !!search || !!brand || source !== 'all' || health !== 'all';

  function preset(p: Preset) {
    setActivePreset(p);
    if (p === 'all') {
      setFrom('');
      setTo('');
    } else if (p === 'start') {
      setFrom(SOLD_DATA_START);
      setTo('');
    } else {
      const d = new Date();
      d.setDate(d.getDate() - p);
      setFrom(ymd(d));
      setTo('');
    }
  }

  function resetFilters() {
    setSearch('');
    setBrand('');
    setSource('all');
    setHealth('all');
    preset('start');
  }

  const periodLabel = from
    ? `${shortDate(from)} → ${to ? shortDate(to) : 'today'}`
    : 'All time';

  return (
    <>
      <TopNav title="Sold" onMenu={onMenu} />
      <div className="space-y-4 p-4">
        {/* Period controls */}
        <div className="sticky top-0 z-10 rounded-xl border border-edge bg-card/95 p-3 backdrop-blur">
          {/* Presets are the primary control; date pickers are the escape hatch */}
          <div className="flex flex-wrap items-center gap-1.5">
            <PresetChip label="Since 1 Jun" active={activePreset === 'start'} onClick={() => preset('start')} />
            <PresetChip label="Last 7 days" active={activePreset === 7} onClick={() => preset(7)} />
            <PresetChip label="Last 30 days" active={activePreset === 30} onClick={() => preset(30)} />
            <PresetChip label="All time" active={activePreset === 'all'} onClick={() => preset('all')} />
            <details className="relative ml-auto">
              <summary className="cursor-pointer list-none rounded-full border border-edge bg-black/20 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-gold/60 hover:text-gold">
                {activePreset == null ? `📅 ${periodLabel}` : '📅 Custom'}
              </summary>
              <div className="absolute right-0 z-20 mt-2 flex gap-3 rounded-xl border border-edge bg-card p-3 shadow-xl">
                <label className="flex flex-col text-xs text-neutral-500">
                  From
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => {
                      setFrom(e.target.value);
                      setActivePreset(null);
                    }}
                    className="input mt-1 w-auto"
                  />
                </label>
                <label className="flex flex-col text-xs text-neutral-500">
                  To
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => {
                      setTo(e.target.value);
                      setActivePreset(null);
                    }}
                    className="input mt-1 w-auto"
                  />
                </label>
              </div>
            </details>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search brand, model, colour, runner…"
                className="input pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-200"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            <select
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="input w-auto"
            >
              <option value="">All brands</option>
              {brands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'all' | 'auto' | 'manual')}
              className="input w-auto"
            >
              <option value="all">Any source</option>
              <option value="auto">Auto only</option>
              <option value="manual">Manual only</option>
            </select>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="input w-auto"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  Sort: {s.label}
                </option>
              ))}
            </select>
            {filtersActive && (
              <button
                onClick={resetFilters}
                className="rounded-lg border border-edge bg-black/20 px-3 py-2 text-sm text-neutral-400 transition hover:border-gold/60 hover:text-gold"
              >
                ↺ Reset
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* KPI summary for the period */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Units sold" value={String(k.units)} sub={periodLabel} />
              <Kpi label="Revenue" value={eur(k.revenue)} />
              <Kpi label="Cost" value={eur(k.cost)} />
              <Kpi
                label="Net profit"
                value={eur(k.profit)}
                tone={k.profit >= 0 ? 'good' : 'bad'}
              />
              <Kpi label="Margin" value={pct(k.margin)} tone={k.margin == null ? undefined : k.margin >= 0 ? 'good' : 'bad'} />
              <Kpi
                label="Avg days to sell"
                value={k.avgSpeed == null ? '—' : `${k.avgSpeed.toFixed(0)}d`}
                sub={k.best ? `Top: ${k.best.brand} ${eur(profitOf(k.best))}` : undefined}
              />
            </div>

            {/* Profit-health insights — only when there's something worth flagging */}
            {scoped.length > 0 && (health$.counts.loss > 0 || health$.counts.nocost > 0) && (
              <div className="space-y-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
                {health$.counts.nocost > 0 && (
                  <button
                    onClick={() => setHealth('nocost')}
                    className="block text-left text-amber-300 hover:underline"
                  >
                    ⚠ {health$.counts.nocost} {health$.counts.nocost === 1 ? 'sale is' : 'sales are'}{' '}
                    missing cost data — their profit &amp; margin are overstated. Tap to review.
                  </button>
                )}
                {health$.counts.loss > 0 && (
                  <button
                    onClick={() => setHealth('loss')}
                    className="block text-left text-red-300 hover:underline"
                  >
                    🔴 {health$.counts.loss} {health$.counts.loss === 1 ? 'item' : 'items'} sold below
                    cost ({eur(health$.lossTotal)}). Tap to review.
                  </button>
                )}
              </div>
            )}

            {/* Profit-health filter chips */}
            {scoped.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'profit', 'loss', 'nocost'] as Health[]).map((h) => (
                  <PresetChip
                    key={h}
                    label={`${HEALTH_LABEL[h]} ${health$.counts[h]}`}
                    active={health === h}
                    onClick={() => setHealth(h)}
                  />
                ))}
              </div>
            )}

            {/* Results header */}
            {sorted.length > 0 && (
              <div className="flex items-center justify-between px-1 text-xs text-neutral-500">
                <span>
                  <span className="text-neutral-300">{sorted.length}</span>{' '}
                  {sorted.length === 1 ? 'sale' : 'sales'} · {periodLabel}
                </span>
                <span>{SORTS.find((s) => s.key === sort)?.label}</span>
              </div>
            )}

            {/* Dated sales list */}
            {sorted.length === 0 ? (
              health !== 'all' && scoped.length > 0 ? (
                <EmptyState
                  title={`No "${HEALTH_LABEL[health]}" sales here`}
                  message="No sales match this filter in the chosen period. Switch back to All."
                  icon="🔍"
                />
              ) : (
                <EmptyState
                  title="No sales in this period"
                  message="Try a wider date range, or check the imported sales below."
                  icon="💰"
                />
              )
            ) : (
              <div className="space-y-2">
                {sorted.map((it) => (
                  <SoldRow
                    key={it.id}
                    item={it}
                    onOpen={() => setSelected(it)}
                    onFixCost={() => setFixItem(it)}
                  />
                ))}
              </div>
            )}

            {/* Undated / imported sales */}
            {undated.length > 0 && (
              <div className="rounded-xl border border-edge bg-card">
                <button
                  onClick={() => setShowUndated((v) => !v)}
                  className="flex w-full items-center justify-between p-3 text-left text-sm text-neutral-300"
                >
                  <span>
                    {showUndated ? '▾' : '▸'} Imported sales without a date{' '}
                    <span className="text-neutral-500">({undated.length})</span>
                  </span>
                  <span className="text-xs text-neutral-500">excluded from the totals above</span>
                </button>
                {showUndated && (
                  <div className="space-y-2 p-3 pt-0">
                    {undated.map((it) => (
                      <SoldRow
                        key={it.id}
                        item={it}
                        onOpen={() => setSelected(it)}
                        onFixCost={() => setFixItem(it)}
                        undated
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ItemDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        onChanged={bumpRefresh}
      />
      <FixCostModal
        item={fixItem}
        onClose={() => setFixItem(null)}
        onChanged={bumpRefresh}
      />
    </>
  );
}

function PresetChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs transition ${
        active
          ? 'border-gold/60 bg-gold/15 font-medium text-gold'
          : 'border-edge bg-black/20 text-neutral-300 hover:border-gold/60 hover:text-gold'
      }`}
    >
      {label}
    </button>
  );
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad';
}) {
  const valueColor =
    tone === 'good' ? 'text-status-stock' : tone === 'bad' ? 'text-red-400' : 'text-neutral-100';
  return (
    <div className="rounded-xl border border-edge bg-card p-3">
      <div className="text-[11px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${valueColor}`}>{value}</div>
      {sub && <div className="mt-0.5 truncate text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: 'good' | 'bad';
}) {
  const color =
    tone === 'good' ? 'text-status-stock' : tone === 'bad' ? 'text-red-400' : 'text-neutral-200';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}

function SoldRow({
  item: it,
  onOpen,
  onFixCost,
  undated,
}: {
  item: Item;
  onOpen: () => void;
  onFixCost: () => void;
  undated?: boolean;
}) {
  const cost = totalCost(it);
  const profit = profitOf(it);
  const speed = daysListed(it);
  const roi = cost > 0 ? (profit / cost) * 100 : null;
  // How the final sale compares with the price it was listed at.
  const vsListed =
    it.listedPrice != null && it.salePrice != null && it.listedPrice > 0
      ? ((it.salePrice - it.listedPrice) / it.listedPrice) * 100
      : null;
  const isAuto = isAutoSale(it);
  const posted = listedDate(it);

  const speedTone = speed == null ? undefined : speed <= 7 ? 'good' : speed > 21 ? 'bad' : undefined;
  const speedLabel =
    speed == null ? '—' : `${speed}d${speed <= 7 ? ' ⚡' : speed > 21 ? ' 🐌' : ''}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="w-full cursor-pointer rounded-xl border border-edge bg-card p-3 text-left transition hover:border-gold/40 focus:border-gold/60 focus:outline-none"
    >
      <div className="flex gap-3">
        <ItemImage
          src={it.photoUrl}
          alt={`${it.brand} ${it.model}`}
          className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
          fallbackClassName="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-black/30 text-2xl"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate font-medium text-neutral-100">{it.brand}</div>
              <div className="truncate text-xs text-neutral-500">
                {it.model}
                {it.color ? ` · ${it.color}` : ''}
                {it.grade ? ` · Grade ${it.grade}` : ''}
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              {cost <= 0 && (
                <span
                  className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-300"
                  title="No purchase/shipping cost recorded — profit & margin are overstated"
                >
                  ⚠ no cost
                </span>
              )}
              <span
                className={`rounded-full border px-2 py-0.5 text-[10px] ${
                  isAuto
                    ? 'border-status-stock/40 bg-status-stock/15 text-status-stock'
                    : 'border-edge bg-black/20 text-neutral-400'
                }`}
              >
                {isAuto ? 'Auto' : 'Manual'}
              </span>
            </div>
          </div>

          {/* Posted → Sold timeline */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-neutral-500">
            <span className="inline-flex items-center gap-1 rounded-md bg-black/30 px-1.5 py-0.5">
              🗓 Posted <span className="text-neutral-300">{shortDate(posted)}</span>
            </span>
            <span aria-hidden className="text-neutral-600">→</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-black/30 px-1.5 py-0.5">
              💰 Sold <span className="text-neutral-300">{undated ? '—' : shortDate(it.soldAt)}</span>
            </span>
            {it.runner?.name && <span>· 🏃 {it.runner.name}</span>}
            {it.vintedLikes != null && <span>· ❤ {it.vintedLikes}</span>}
          </div>

          {/* Metric grid */}
          <div className="mt-3 grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-6">
            <Metric label="Sale" value={eur(it.salePrice)} />
            <Metric label="Cost" value={cost > 0 ? eur(cost) : money(it.purchasePrice, it.purchaseCurrency)} />
            <Metric
              label="Net profit"
              value={eur(profit)}
              tone={profit >= 0 ? 'good' : 'bad'}
            />
            <Metric
              label="Margin"
              value={pct(it.marginPct)}
              tone={it.marginPct == null ? undefined : it.marginPct >= 0 ? 'good' : 'bad'}
            />
            <Metric
              label="ROI"
              value={roi == null ? '—' : pct(roi)}
              tone={roi == null ? undefined : roi >= 0 ? 'good' : 'bad'}
            />
            <Metric label="Days to sell" value={speedLabel} tone={speedTone} />
          </div>

          {/* Listed vs sold context */}
          {it.listedPrice != null && (
            <div className="mt-2 text-[11px] text-neutral-500">
              Listed {eur(it.listedPrice)}
              {vsListed != null && (
                <span className={vsListed >= 0 ? ' text-status-stock' : ' text-amber-400'}>
                  {' '}
                  · {vsListed >= 0 ? '+' : ''}
                  {vsListed.toFixed(0)}% vs listed
                </span>
              )}
            </div>
          )}

          {/* One-tap fix for flagged rows */}
          {cost <= 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFixCost();
              }}
              className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 transition hover:bg-amber-500/20"
            >
              ⚙ Fix cost
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
