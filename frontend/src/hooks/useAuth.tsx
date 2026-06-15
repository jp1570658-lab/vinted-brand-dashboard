import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/endpoints';
import type { HealthInfo } from '../api/types';

interface AuthState {
  authenticated: boolean;
  loading: boolean;
  mode: 'DEMO' | 'LIVE';
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'DEMO' | 'LIVE'>('DEMO');

  const refresh = useCallback(async () => {
    try {
      const [me, health] = await Promise.all([
        api.auth.me(),
        api.health().catch(() => ({ mode: 'DEMO' }) as HealthInfo),
      ]);
      setAuthenticated(me.authenticated);
      setMode(health.mode);
    } catch {
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (password: string) => {
    await api.auth.login(password);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    setAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, loading, mode, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
