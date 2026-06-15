import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export function Login() {
  const { login, mode } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(password);
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-edge bg-card p-7"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gold/20 text-2xl">
            👜
          </div>
          <h1 className="text-xl font-bold text-gold">Vinted Brand Dashboard</h1>
          <p className="mt-1 text-xs text-neutral-500">
            {mode} mode {mode === 'DEMO' ? '· password: demo1234' : ''}
          </p>
        </div>

        <label className="mb-1 block text-xs font-medium text-neutral-400">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          autoFocus
          placeholder="••••••••"
        />

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button type="submit" disabled={busy} className="btn-gold mt-5 w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
