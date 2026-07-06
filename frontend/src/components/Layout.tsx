import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { FloatingAddButton } from './FloatingAddButton';
import { QuickIntakeModal } from './QuickIntakeModal';
import { AlertBanner } from './AlertBanner';

const NAV = [
  { to: '/', label: 'Dashboard', icon: '📊', end: true },
  { to: '/future', label: 'Future Stock', icon: '🌱' },
  { to: '/transit', label: 'In Transit', icon: '✈️' },
  { to: '/stock', label: 'In Stock', icon: '🏷️' },
  { to: '/sold', label: 'Sold', icon: '💰' },
  { to: '/analytics', label: 'Analytics', icon: '📈' },
  { to: '/transactions', label: 'Transactions', icon: '🧾' },
  { to: '/reconcile', label: 'Reconcile', icon: '⚖️' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

// Bumping this key forces data hooks to refetch after an intake/change.
export function Layout() {
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) / drawer (mobile) */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-60 transform border-r border-edge bg-card p-4 transition-transform md:static md:translate-x-0 ${
          navOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="text-xl">👜</span>
          <span className="font-bold text-gold">Vinted</span>
        </div>
        <nav className="space-y-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-gold/15 text-gold'
                    : 'text-neutral-400 hover:bg-black/30 hover:text-neutral-100'
                }`
              }
            >
              <span>{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {navOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 md:hidden"
          onClick={() => setNavOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AlertBanner key={`banner-${refreshKey}`} />
        <main className="flex-1">
          {/* refreshKey is consumed via context-free remount of routed pages */}
          <Outlet context={{ refreshKey, bumpRefresh: () => setRefreshKey((k) => k + 1), openIntake: () => setIntakeOpen(true), onMenu: () => setNavOpen(true) }} />
        </main>
      </div>

      <FloatingAddButton onClick={() => setIntakeOpen(true)} />
      <QuickIntakeModal
        open={intakeOpen}
        onClose={() => setIntakeOpen(false)}
        onCreated={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}
