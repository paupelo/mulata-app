// Formato de moneda en dólares (Panamá usa USD): $1,234.56
const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(n) {
  const value = Number(n) || 0;
  return currencyFmt.format(value);
}

// Versión compacta para etiquetas de gráficos: $1.2k
export function moneyShort(n) {
  const value = Number(n) || 0;
  if (Math.abs(value) >= 1000) return '$' + (value / 1000).toFixed(1) + 'k';
  return '$' + value.toFixed(0);
}

// Formatea una fecha ISO (YYYY-MM-DD) a "12 jun 2026".
const dateFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return dateFmt.format(d);
}

// Etiqueta corta para buckets de gráfico según granularidad.
export function bucketLabel(iso, granularity) {
  const d = new Date(iso + 'T00:00:00');
  if (granularity === 'month') {
    return d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
  }
  if (granularity === 'week') {
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export function percent(n) {
  return (Number(n) || 0).toFixed(1) + '%';
}

// Fecha de hoy en formato YYYY-MM-DD (para inputs date).
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
