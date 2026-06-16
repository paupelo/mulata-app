import { NavLink } from 'react-router-dom';

const ITEMS = [
  { to: '/', label: 'General', icon: '📊', end: true },
  { to: '/megapolis', label: 'Megapolis', icon: '🏬' },
  { to: '/casco', label: 'Casco', icon: '🏛️' },
  { to: '/distribucion', label: 'Distrib.', icon: '📦' },
  { to: '/analitica', label: 'Analítica', icon: '📈' },
];

// Navegación inferior fija para móvil.
export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-mulata-50 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex">
        {ITEMS.map((it) => (
          <li key={it.to} className="flex-1">
            <NavLink
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] transition ${
                  isActive ? 'text-mulata-700' : 'text-ink/40'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-xl transition-transform ${isActive ? 'scale-110' : ''}`}>{it.icon}</span>
                  {it.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
