import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useStats } from '../hooks/useStats';
import { api } from '../api/endpoints';
import { TopNav } from '../components/TopNav';
import { KPICard } from '../components/KPICard';
import { AIInsights } from '../components/AIInsights';
import { Skeleton } from '../components/Skeleton';
import { eur } from '../lib/format';
import { soldNeedsCost } from '../lib/cost';
import { useLayout } from '../hooks/useLayout';

const TILES = [
  { to: '/future', label: 'Future Stock', icon: '🌱' },
  { to: '/transit', label: 'In Transit', icon: '✈️' },
  { to: '/stock', label: 'In Stock', icon: '🏷️' },
  { to: '/sold', label: 'Sold', icon: '💰' },
  { to: '/transactions', label: 'Transactions', icon: '🧾' },
  { to: '/reconcile', label: 'Reconcile', icon: '⚖️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Dashboard() {
  const { refreshKey, onMenu } = useLayout();
  const { stats, loading } = useStats();

  // Reconciliation backlog: sold items with no recorded cost (profit overstated).
  const [needsCost, setNeedsCost] = useState(0);
  useEffect(() => {
    api.items
      .list({ status: 'SOLD', limit: 200 })
      .then((res) => setNeedsCost(res.data.filter(soldNeedsCost).length))
      .catch(() => setNeedsCost(0));
  }, [refreshKey]);

  const counts = stats?.countByStatus;

  return (
    <>
      <TopNav title="Dashboard" onMenu={onMenu} />
      <div className="space-y-5 p-4">
        {/* KPI row */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <KPICard label="Revenue (Month)" value={eur(stats?.revenueMonth)} accent />
            <KPICard label="Revenue (Year)" value={eur(stats?.revenueYear)} />
            <KPICard label="Net Profit (Month)" value={eur(stats?.netProfitMonth)} accent />
            <KPICard label="Inventory Value" value={eur(stats?.inventoryValue)} />
            <KPICard
              label="Items by Status"
              value={
                <span className="text-base font-semibold">
                  {(counts?.SOURCED ?? 0) +
                    (counts?.IN_TRANSIT ?? 0) +
                    (counts?.IN_STOCK ?? 0)}{' '}
                  <span className="text-xs text-neutral-500">active</span>
                </span>
              }
              sub={
                counts
                  ? `${counts.SOURCED} sourced · ${counts.IN_TRANSIT} transit · ${counts.IN_STOCK} stock · ${counts.SOLD} sold`
                  : undefined
              }
            />
          </div>
        )}

        {/* Needs attention — reconciliation backlog */}
        {needsCost > 0 && (
          <Link
            to="/reconcile"
            className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 transition hover:border-amber-500/60"
          >
            <span className="text-2xl">⚖️</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-amber-200">Needs attention</div>
              <div className="text-xs text-amber-300/80">
                {needsCost} sold {needsCost === 1 ? 'item is' : 'items are'} missing cost — profit
                &amp; margin are overstated.
              </div>
            </div>
            <span className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200">
              Reconcile →
            </span>
          </Link>
        )}

        <AIInsights />

        {/* Quick nav */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-neutral-400">Sections</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {TILES.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="relative flex flex-col items-center gap-1 rounded-xl border border-edge bg-card p-4 text-center text-xs text-neutral-300 transition hover:border-gold/50 hover:text-gold"
              >
                {t.to === '/reconcile' && needsCost > 0 && (
                  <span
                    className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black"
                    title={`${needsCost} sold items missing cost`}
                  >
                    {needsCost}
                  </span>
                )}
                <span className="text-2xl">{t.icon}</span>
                {t.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
