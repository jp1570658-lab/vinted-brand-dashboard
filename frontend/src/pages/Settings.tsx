import { useCallback, useEffect, useState } from 'react';
import type { Runner } from '../api/types';
import { api } from '../api/endpoints';
import { TopNav } from '../components/TopNav';
import { useAuth } from '../hooks/useAuth';
import { useLayout } from '../hooks/useLayout';

export function Settings() {
  const { mode } = useAuth();
  const { onMenu, bumpRefresh } = useLayout();
  const [runners, setRunners] = useState<Runner[]>([]);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [gmailMsg, setGmailMsg] = useState<string | null>(null);
  const [wiseMsg, setWiseMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<'gmail' | 'wise' | null>(null);

  const loadRunners = useCallback(() => {
    api.runners.list().then((r) => setRunners(r.data));
  }, []);

  useEffect(() => {
    loadRunners();
  }, [loadRunners]);

  async function addRunner(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !location.trim()) return;
    await api.runners.create({ name: name.trim(), location: location.trim() });
    setName('');
    setLocation('');
    loadRunners();
  }

  async function syncGmail() {
    setSyncing('gmail');
    setGmailMsg(null);
    try {
      const r = await api.sync.gmail();
      setGmailMsg(r.pending || `Synced: ${r.salesFound ?? 0} sale(s) found.`);
      bumpRefresh();
    } catch (e: any) {
      setGmailMsg(e?.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  }

  async function syncWise() {
    setSyncing('wise');
    setWiseMsg(null);
    try {
      const r = await api.sync.wise();
      setWiseMsg(r.pending || `Synced: ${r.imported ?? 0} new transaction(s).`);
      bumpRefresh();
    } catch (e: any) {
      setWiseMsg(e?.message || 'Sync failed');
    } finally {
      setSyncing(null);
    }
  }

  return (
    <>
      <TopNav title="Settings" onMenu={onMenu} />
      <div className="max-w-2xl space-y-6 p-4">
        {/* Integrations */}
        <Section title="Integrations">
          <div className="space-y-3">
            <SyncRow
              label="Gmail — Vinted sale detection"
              busy={syncing === 'gmail'}
              onSync={syncGmail}
              message={gmailMsg}
            />
            <SyncRow
              label="Wise — expense transactions"
              busy={syncing === 'wise'}
              onSync={syncWise}
              message={wiseMsg}
            />
            <p className="text-xs text-neutral-600">
              Mode is <strong>{mode}</strong>. In DEMO, syncs return realistic mock data.
            </p>
          </div>
        </Section>

        {/* Runners */}
        <Section title="Runners">
          <ul className="mb-3 divide-y divide-edge/50 rounded-lg border border-edge">
            {runners.map((r) => (
              <li key={r.id} className="flex items-center justify-between p-3 text-sm">
                <div>
                  <div className="font-medium text-neutral-100">{r.name}</div>
                  <div className="text-xs text-neutral-500">{r.location}</div>
                </div>
                <span className="text-xs text-neutral-500">{r._count?.items ?? 0} items</span>
              </li>
            ))}
            {runners.length === 0 && <li className="p-3 text-sm text-neutral-500">No runners yet.</li>}
          </ul>
          <form onSubmit={addRunner} className="flex flex-wrap gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="input flex-1" />
            <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Location" className="input flex-1" />
            <button type="submit" className="btn-gold">Add</button>
          </form>
        </Section>

        {/* Security */}
        <Section title="Security">
          <p className="text-sm text-neutral-400">
            The dashboard password is set via the <code className="text-gold">DASHBOARD_PASSWORD</code>{' '}
            environment variable. Change it in your deployment settings and restart.
          </p>
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-edge bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-neutral-300">{title}</h2>
      {children}
    </div>
  );
}

function SyncRow({
  label,
  busy,
  onSync,
  message,
}: {
  label: string;
  busy: boolean;
  onSync: () => void;
  message: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-black/20 p-3">
      <div>
        <div className="text-sm text-neutral-200">{label}</div>
        {message && <div className="mt-0.5 text-xs text-neutral-500">{message}</div>}
      </div>
      <button onClick={onSync} disabled={busy} className="btn-ghost shrink-0">
        {busy ? 'Syncing…' : 'Sync now'}
      </button>
    </div>
  );
}
