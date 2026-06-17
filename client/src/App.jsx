import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Login from './auth/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import StorePage from './pages/StorePage';
import Distribution from './pages/Distribution';
import GeneralExpenses from './pages/GeneralExpenses';
import Analytics from './pages/Analytics';
import Proveedores from './pages/Proveedores';
import Settings from './pages/Settings';

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-cream">
        <div className="h-12 w-12 rounded-full border-4 border-mulata-200 border-t-mulata-600 animate-spin" />
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="megapolis" element={<StorePage unitCode="megapolis" title="Tienda Megapolis" emoji="🏬" />} />
        <Route path="casco" element={<StorePage unitCode="casco" title="Tienda Casco Antiguo" emoji="🏛️" />} />
        <Route path="distribucion" element={<Distribution />} />
        <Route path="gastos-generales" element={<GeneralExpenses />} />
        <Route path="proveedores" element={<Proveedores />} />
        <Route path="analitica" element={<Analytics />} />
        <Route path="ajustes" element={<Settings />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
