import { ReactNode } from 'react';

interface Props {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
}

export function KPICard({ label, value, sub, accent }: Props) {
  return (
    <div className="rounded-xl border border-edge bg-card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? 'text-gold' : 'text-neutral-100'}`}>
        {value}
      </div>
      {sub != null && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
    </div>
  );
}
