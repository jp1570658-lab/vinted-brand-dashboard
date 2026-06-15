import { useEffect, useState } from 'react';
import { api } from '../api/endpoints';
import { eur } from '../lib/format';
import { Skeleton } from './Skeleton';

// Renders the AI forecast + top-runner recommendation. Tolerates the Step 5/8
// stub shape (pending) and the empty-DB fallback ({ message }).
export function AIInsights() {
  const [forecast, setForecast] = useState<any>(null);
  const [sourcing, setSourcing] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.ai.forecast().catch(() => null),
      api.ai.sourcing().catch(() => null),
    ])
      .then(([f, s]) => {
        setForecast(f);
        setSourcing(s);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-40 w-full rounded-xl" />;

  const pending = forecast?.pending || sourcing?.pending;
  const notEnough = forecast?.message;

  return (
    <div className="rounded-xl border border-edge bg-gradient-to-br from-card to-black/40 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg">🤖</span>
        <h2 className="font-semibold text-neutral-100">AI Insights</h2>
      </div>

      {pending ? (
        <p className="text-sm text-neutral-500">AI insights activate in Step 8.</p>
      ) : notEnough ? (
        <p className="text-sm text-neutral-400">{forecast.message}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {forecast && (
            <div>
              <div className="text-xs uppercase text-neutral-500">Revenue forecast</div>
              <div className="mt-1 text-xl font-bold text-gold">
                {eur(forecast.forecastRevenue)}
              </div>
              <div className="text-xs text-neutral-500">
                Profit {eur(forecast.forecastProfit)} · {forecast.confidence} confidence
              </div>
              {forecast.narrative && (
                <p className="mt-2 text-xs leading-relaxed text-neutral-400">{forecast.narrative}</p>
              )}
            </div>
          )}
          {sourcing && (sourcing.priorityThisWeek || Array.isArray(sourcing.runners)) && (
            <div>
              <div className="text-xs uppercase text-neutral-500">Top runner this week</div>
              <div className="mt-1 text-xl font-bold text-neutral-100">
                {sourcing.priorityThisWeek || sourcing.runners?.[0]?.runnerName}
              </div>
              {sourcing.runners?.[0] && (
                <div className="text-xs text-neutral-500">
                  {sourcing.runners[0].avgMarginPct}% avg margin ·{' '}
                  {sourcing.runners[0].avgDaysToSell}d to sell
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
