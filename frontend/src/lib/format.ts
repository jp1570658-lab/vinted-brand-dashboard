// Currency: always EUR, formatted as €1,234.56
export function eur(value: number | null | undefined): string {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

// Raw amount in its own currency (for purchase price display).
export function money(value: number | null | undefined, currency: string): string {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(value);
  } catch {
    return `${value} ${currency}`;
  }
}

export function pct(value: number | null | undefined): string {
  if (value == null) return '—';
  return `${value.toFixed(1)}%`;
}

export function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const then = new Date(iso).getTime();
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

// Whole days between two timestamps (later − earlier). null if either is missing.
export function daysBetween(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function relativeFromNow(iso: string | null | undefined): string {
  if (!iso) return 'never';
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export const AGING_THRESHOLD_DAYS = 14;
