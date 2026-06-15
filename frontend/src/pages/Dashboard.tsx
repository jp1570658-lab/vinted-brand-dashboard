import { Link } from 'react-router-dom';
import { useStats } from '../hooks/useStats';
import { TopNav } from '../components/TopNav';
import { KPICard } from '../components/KPICard';
import { AIInsights } from '../components/AIInsights';
import { Skeleton } from '../components/Skeleton';
import { eur } from '../lib/format';
import { useLayout } from '../hooks/useLayout';

const TILES = [
  { to: '/future', label: 'Future Stock', icon: '🌱' },
  { to: '/transit', label: 'In Transit', icon: '✈️' },
  { to: '/stock', label: 'In Stock', icon: '🏷️' },
  { to: '/sold', label: 'Sold', icon: '💰' },
  { to: '/transactions', label: 'Transactions', icon: '🧾' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export function Dashboard() {
  const { refreshKey, onMenu } = useLayout();
  const { stats, loading } = useStats();
  // refreshKey forces remount via key on the wrapper below.
  void refreshKey;

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

        <AIInsights />

        {/* Quick nav */}
        <div>
          <h2 className="mb-2 text-sm font-semibold text-neutral-400">Sections</h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {TILES.map((t) => (
              <Link
                key={t.to}
                to={t.to}
                className="flex flex-col items-center gap-1 rounded-xl border border-edge bg-card p-4 text-center text-xs text-neutral-300 transition hover:border-gold/50 hover:text-gold"
              >
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
