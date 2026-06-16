// Utilidades para los presets de rango de fechas del dashboard.

function iso(d) {
  return d.toISOString().slice(0, 10);
}

export function getRange(preset) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (preset) {
    case 'this-month':
      return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    case 'last-month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
    case 'this-year':
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
    case 'last-30':
    default: {
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from: iso(from), to: iso(to) };
    }
  }
}

export const PRESETS = [
  { key: 'this-month', label: 'Este mes' },
  { key: 'last-month', label: 'Mes pasado' },
  { key: 'last-30', label: 'Últimos 30 días' },
  { key: 'this-year', label: 'Este año' },
  { key: 'custom', label: 'Personalizado' },
];
