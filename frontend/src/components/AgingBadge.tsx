import { AGING_THRESHOLD_DAYS, daysSince } from '../lib/format';

interface Props {
  since: string | null | undefined;
  location?: string | null;
}

/** Aging timer. Goes red + pulsing once an item is over the threshold. */
export function AgingBadge({ since, location }: Props) {
  const days = daysSince(since);
  const aged = days > AGING_THRESHOLD_DAYS;
  const where = location ? ` in ${location}` : '';

  if (aged) {
    return (
      <span className="animate-aging inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
        ⚠️ {days} days{where}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-edge bg-black/20 px-2 py-0.5 text-xs text-neutral-400">
      {days}d{where}
    </span>
  );
}

export function isAged(since: string | null | undefined): boolean {
  return daysSince(since) > AGING_THRESHOLD_DAYS;
}
