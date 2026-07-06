import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { FutureStock } from './pages/FutureStock';
import { InTransit } from './pages/InTransit';
import { InStock } from './pages/InStock';
import { Sold } from './pages/Sold';
import { Analytics } from './pages/Analytics';
import { Transactions } from './pages/Transactions';
import { Reconcile } from './pages/Reconcile';
import { Settings } from './pages/Settings';

function Gate() {
  const { authenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-neutral-500">
        Loading…
      </div>
    );
  }

  if (!authenticated) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/future" element={<FutureStock />} />
        <Route path="/transit" element={<InTransit />} />
        <Route path="/stock" element={<InStock />} />
        <Route path="/sold" element={<Sold />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/reconcile" element={<Reconcile />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}
