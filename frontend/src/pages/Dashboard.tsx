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
import { isUnlinked } from '../lib/tx';
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

  // Attention signals: sold items with no recorded cost (profit overstated) and
  // payments not yet linked to an item.
  const [needsCost, setNeedsCost] = useState(0);
  const [unlinked, setUnlinked] = useState(0);
  useEffect(() => {
    Promise.all([api.items.list({ status: 'SOLD', limit: 200 }), api.transactions.list({ limit: 200 })])
      .then(([sold, txns]) => {
        setNeedsCost(sold.data.filter(soldNeedsCost).length);
        setUnlinked(txns.data.filter(isUnlinked).length);
      })
      .catch(() => {
        setNeedsCost(0);
        setUnlinked(0);
      });
  }, [refreshKey]);

  const counts = stats?.countByStatus;
  // Per-tile backlog badges.
  const badges: Record<string, number> = { '/reconcile': needsCost, '/transactions': unlinked };

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

        {/* Needs attention — reconciliation & linking backlog */}
        {(needsCost > 0 || unlinked > 0) && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            <div className="mb-2 px-1 text-sm font-semibold text-amber-200">Needs attention</div>
            <div className="space-y-1.5">
              {needsCost > 0 && (
                <AttentionRow
                  to="/reconcile"
                  icon="⚖️"
                  text={`${needsCost} sold ${needsCost === 1 ? 'item is' : 'items are'} missing cost — profit & margin overstated`}
                  cta="Reconcile →"
                />
              )}
              {unlinked > 0 && (
                <AttentionRow
                  to="/transactions"
                  icon="🧾"
                  text={`${unlinked} ${unlinked === 1 ? "payment isn’t" : "payments aren’t"} linked to an item`}
                  cta="Link →"
                />
              )}
            </div>
          </div>
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
                {badges[t.to] > 0 && (
                  <span className="absolute right-1.5 top-1.5 min-w-[18px] rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                    {badges[t.to]}
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

function AttentionRow({
  to,
  icon,
  text,
  cta,
}: {
  to: string;
  icon: string;
  text: string;
  cta: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-amber-500/20 bg-black/10 px-3 py-2 transition hover:border-amber-500/50"
    >
      <span className="text-xl">{icon}</span>
      <span className="min-w-0 flex-1 text-xs text-amber-300/90">{text}</span>
      <span className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-200">
        {cta}
      </span>
    </Link>
  );
}
