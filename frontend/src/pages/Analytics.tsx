import { useEffect, useState } from 'react';
import type { Analytics as AnalyticsData, BreakdownRow, MonthPoint } from '../api/types';
import { api } from '../api/endpoints';
import { TopNav } from '../components/TopNav';
import { KPICard } from '../components/KPICard';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import { eur, pct } from '../lib/format';
import { useLayout } from '../hooks/useLayout';

export function Analytics() {
  const { refreshKey, onMenu } = useLayout();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.items
      .analytics()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  return (
    <>
      <TopNav title="Analytics" onMenu={onMenu} />
      <div className="space-y-6 p-4">
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !data || data.totals.units === 0 ? (
          <EmptyState
            title="No sales to analyse yet"
            message="Once you mark bags as sold, profit trends and brand/runner performance will appear here."
            icon="📈"
          />
        ) : (
          <>
            {/* Totals */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <KPICard label="Total revenue" value={eur(data.totals.revenue)} sub={`${data.totals.units} sold`} />
              <KPICard label="Net profit" value={eur(data.totals.profit)} accent />
              <KPICard label="Avg margin" value={pct(data.totals.avgMarginPct)} />
              <KPICard
                label="Avg days to sell"
                value={data.totals.avgDaysToSell != null ? `${data.totals.avgDaysToSell}d` : '—'}
              />
            </div>

            {/* Monthly trend */}
            <section className="rounded-xl border border-edge bg-card p-4">
              <h2 className="mb-4 text-sm font-semibold text-neutral-200">Last 6 months</h2>
              <MonthlyChart months={data.monthly} />
              <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
                <Legend color="bg-gold" label="Revenue" />
                <Legend color="bg-status-stock" label="Net profit" />
              </div>
            </section>

            {/* Brand breakdown */}
            <BreakdownTable title="By brand" label="Brand" rows={data.byBrand} />

            {/* Runner breakdown */}
            <BreakdownTable title="By runner" label="Runner" rows={data.byRunner} />
          </>
        )}
      </div>
    </>
  );
}

function MonthlyChart({ months }: { months: MonthPoint[] }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.revenue, m.profit)));

  return (
    <div className="flex items-end gap-2 sm:gap-4" style={{ height: 200 }}>
      {months.map((m) => (
        <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-full w-full items-end justify-center gap-1">
            <Bar value={m.revenue} max={max} className="bg-gold" title={`Revenue ${eur(m.revenue)}`} />
            <Bar
              value={m.profit}
              max={max}
              className={m.profit >= 0 ? 'bg-status-stock' : 'bg-red-500'}
              title={`Profit ${eur(m.profit)}`}
            />
          </div>
          <div className="text-[10px] text-neutral-500">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

function Bar({ value, max, className, title }: { value: number; max: number; className: string; title: string }) {
  // Height as a share of the tallest bar; clamp negatives to a sliver so they stay visible.
  const heightPct = Math.max(value <= 0 ? 0 : 2, (Math.abs(value) / max) * 100);
  return (
    <div className="group relative flex w-3 items-end sm:w-5" style={{ height: '100%' }} title={title}>
      <div className={`w-full rounded-t ${className}`} style={{ height: `${heightPct}%` }} />
    </div>
  );
}

function BreakdownTable({ title, label, rows }: { title: string; label: string; rows: BreakdownRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-xl border border-edge">
      <h2 className="border-b border-edge p-3 text-sm font-semibold text-neutral-200">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-edge text-left text-xs uppercase text-neutral-500">
              <th className="p-3">{label}</th>
              <th className="p-3">Units</th>
              <th className="p-3">Revenue</th>
              <th className="p-3">Net profit</th>
              <th className="p-3">Margin</th>
              <th className="p-3">Avg days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-edge/50 last:border-0">
                <td className="p-3 font-medium text-neutral-100">{r.key}</td>
                <td className="p-3 text-neutral-400">{r.units}</td>
                <td className="p-3 text-neutral-200">{eur(r.revenue)}</td>
                <td className={`p-3 font-semibold ${r.profit >= 0 ? 'text-status-stock' : 'text-red-400'}`}>
                  {eur(r.profit)}
                </td>
                <td className="p-3 text-neutral-400">{pct(r.avgMarginPct)}</td>
                <td className="p-3 text-neutral-400">{r.avgDaysToSell != null ? `${r.avgDaysToSell}d` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`inline-block h-2.5 w-2.5 rounded-sm ${color}`} />
      {label}
    </span>
  );
}
