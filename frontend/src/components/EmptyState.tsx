import { ReactNode } from 'react';

interface Props {
  icon?: string;
  title: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ icon = '📭', title, message, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-edge bg-card/50 px-6 py-16 text-center">
      <div className="text-4xl">{icon}</div>
      <h3 className="mt-3 text-base font-semibold text-neutral-200">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-neutral-500">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
