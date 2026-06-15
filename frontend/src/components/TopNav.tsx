import { useAuth } from '../hooks/useAuth';

interface Props {
  title: string;
  lastSynced?: string;
  onMenu?: () => void;
}

export function TopNav({ title, lastSynced, onMenu }: Props) {
  const { mode, logout } = useAuth();
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-edge bg-base/90 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-3">
        {onMenu && (
          <button
            onClick={onMenu}
            className="rounded-md p-1 text-neutral-400 hover:text-neutral-100 md:hidden"
            aria-label="Menu"
          >
            ☰
          </button>
        )}
        <h1 className="text-lg font-semibold text-neutral-100">{title}</h1>
      </div>
      <div className="flex items-center gap-3 text-xs">
        {lastSynced && <span className="hidden text-neutral-500 sm:inline">Synced {lastSynced}</span>}
        <span
          className={`rounded-full border px-2 py-0.5 font-semibold ${
            mode === 'LIVE'
              ? 'border-status-stock/40 bg-status-stock/15 text-status-stock'
              : 'border-gold/40 bg-gold/15 text-gold'
          }`}
        >
          {mode}
        </span>
        <button onClick={() => logout()} className="text-neutral-500 hover:text-neutral-200">
          Logout
        </button>
      </div>
    </header>
  );
}
