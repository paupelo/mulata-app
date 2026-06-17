// Utilidades para los presets de rango de fechas del dashboard.

function iso(d) {
  return d.toISOString().slice(0, 10);
}

export function getRange(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'last-month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'this-year':
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
    case 'this-month':
    default:
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  }
}

// Rango (from, to) de un mes natural concreto.
export function monthRangeOf(year, monthIndex) {
  return { from: iso(new Date(year, monthIndex, 1)), to: iso(new Date(year, monthIndex + 1, 0)) };
}

// Lista de los últimos `count` meses naturales (incluido el actual), del más
// reciente al más antiguo. Cada item: { key, label, range }.
export function recentMonths(count = 12) {
  const now = new Date();
  const list = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }),
      range: monthRangeOf(d.getFullYear(), d.getMonth()),
    });
  }
  return list;
}

export const PRESETS = [
  { key: 'this-month', label: 'Este mes' },
  { key: 'last-month', label: 'Mes pasado' },
  { key: 'this-year', label: 'Este año' },
  { key: 'custom', label: 'Personalizado' },
];
