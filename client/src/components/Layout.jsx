import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useAuth } from '../auth/AuthContext';

const NAV = [
  { to: '/', label: 'General', icon: '📊', end: true },
  { to: '/megapolis', label: 'Tienda Megapolis', icon: '🏬' },
  { to: '/casco', label: 'Tienda Casco Antiguo', icon: '🏛️' },
  { to: '/distribucion', label: 'Distribución', icon: '📦' },
  { to: '/proveedores', label: 'Proveedores', icon: '🚚' },
  { to: '/gastos-generales', label: 'Gastos Generales', icon: '🧾' },
  { to: '/ajustes', label: 'Ajustes', icon: '⚙️' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen lg:flex">
      {/* Barra lateral en escritorio */}
      <aside className="hidden lg:flex lg:flex-col w-64 shrink-0 border-r border-mulata-50 bg-white p-5 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-2xl bg-mulata-600 text-white grid place-items-center shadow-soft">
            <span className="font-display text-2xl">M</span>
          </div>
          <div>
            <p className="font-display text-xl text-mulata-800 leading-none">Mulata</p>
            <p className="text-xs text-ink/50">Cuenta de resultados</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          {NAV.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-mulata-600 text-white shadow-soft' : 'text-ink/70 hover:bg-mulata-50'
                }`
              }
            >
              <span className="text-lg">{it.icon}</span>
              {it.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-mulata-50 pt-4 mt-4">
          <p className="text-xs text-ink/50 mb-2">Sesión: {user}</p>
          <button
            onClick={() => {
              logout();
              navigate('/');
            }}
            className="btn-ghost w-full text-sm"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <div className="flex-1 min-w-0">
        {/* Cabecera móvil */}
        <header className="lg:hidden sticky top-0 z-20 bg-cream/90 backdrop-blur px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-mulata-600 text-white grid place-items-center">
              <span className="font-display text-lg">M</span>
            </div>
            <span className="font-display text-xl text-mulata-800">Mulata</span>
          </div>
          <NavLink to="/ajustes" className="h-9 w-9 grid place-items-center rounded-full bg-white shadow-card">
            ⚙️
          </NavLink>
        </header>

        <main className="px-4 pb-28 pt-2 lg:px-8 lg:py-8 max-w-5xl mx-auto">
          <Outlet />
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
