import { useEffect, useState, useCallback } from 'react';
import { api, qs } from '../api';
import { getRange } from '../lib/dateRanges';
import DateRangePicker from '../components/DateRangePicker';
import KpiCard from '../components/KpiCard';
import SalesTrend from '../components/charts/SalesTrend';
import ProfitTrend from '../components/charts/ProfitTrend';
import MarginTrend from '../components/charts/MarginTrend';
import UnitComparison from '../components/charts/UnitComparison';
import ExpenseBreakdown from '../components/charts/ExpenseBreakdown';

const UNIT_FILTERS = [
  { key: '', label: 'Global' },
  { key: 'megapolis', label: 'Megapolis' },
  { key: 'casco', label: 'Casco Antiguo' },
  { key: 'distribucion', label: 'Distribución' },
];

export default function Analytics() {
  const [preset, setPreset] = useState('this-year');
  const [range, setRange] = useState(getRange('this-year'));
  const [unit, setUnit] = useState('');

  const [summary, setSummary] = useState(null);
  const [salesTrend, setSalesTrend] = useState({ data: [], granularity: 'day' });
  const [profitTrend, setProfitTrend] = useState({ data: [], granularity: 'day' });
  const [marginTrend, setMarginTrend] = useState({ data: [], granularity: 'day' });
  const [comparison, setComparison] = useState([]);
  const [breakdown, setBreakdown] = useState([]);

  const load = useCallback(async () => {
    const base = { from: range.from, to: range.to };
    const withUnit = unit ? { ...base, unit } : base;

    const [sum, st, pt, mt, cmp, bd] = await Promise.all([
      api.get(`/analytics/summary${qs(withUnit)}`),
      api.get(`/analytics/sales-trend${qs(withUnit)}`),
      api.get(`/analytics/profit-trend${qs(base)}`),
      api.get(`/analytics/margin-trend${qs(base)}`),
      api.get(`/analytics/unit-comparison${qs(base)}`),
      api.get(`/analytics/expense-breakdown${qs(withUnit)}`),
    ]);
    setSummary(sum);
    setSalesTrend(st);
    setProfitTrend(pt);
    setMarginTrend(mt);
    setComparison(cmp);
    setBreakdown(bd);
  }, [range.from, range.to, unit]);

  useEffect(() => {
    load().catch((e) => console.error(e));
  }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl text-mulata-800">📈 Analítica</h1>
        <p className="text-ink/50 text-sm">Métricas y evolución del negocio</p>
      </div>

      <DateRangePicker preset={preset} range={range} onChange={(s) => { setPreset(s.preset); setRange(s.range); }} />

      {/* Filtro por unidad de negocio */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {UNIT_FILTERS.map((u) => (
          <button
            key={u.key}
            onClick={() => setUnit(u.key)}
            className={`chip whitespace-nowrap px-3 py-1.5 ${
              unit === u.key ? 'bg-mulata-700 text-white' : 'bg-white text-ink/60 shadow-card'
            }`}
          >
            {u.label}
          </button>
        ))}
      </div>

      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Ventas" value={summary.sales.value} variation={summary.sales.variation} />
          <KpiCard label="Gastos" value={summary.expenses.value} variation={summary.expenses.variation} />
          <KpiCard label="Beneficio" value={summary.profit.value} variation={summary.profit.variation} accent />
          <KpiCard label="Margen" value={summary.margin.value} variationPoints={summary.margin.variationPoints} format="percent" />
        </div>
      )}

      <SalesTrend data={salesTrend.data} granularity={salesTrend.granularity} />
      <MarginTrend data={marginTrend.data} granularity={marginTrend.granularity} />
      <ProfitTrend data={profitTrend.data} granularity={profitTrend.granularity} />
      <UnitComparison data={comparison} />
      <ExpenseBreakdown data={breakdown} />
    </div>
  );
}
