import { useEffect, useState, useCallback } from 'react';
import { api, qs } from '../api';
import { getRange } from '../lib/dateRanges';
import DateRangePicker from '../components/DateRangePicker';
import KpiCard from '../components/KpiCard';
import SalesTrend from '../components/charts/SalesTrend';
import UnitComparison from '../components/charts/UnitComparison';
import { money } from '../lib/format';

export default function Dashboard() {
  const [preset, setPreset] = useState('this-month');
  const [range, setRange] = useState(getRange('this-month'));
  const [summary, setSummary] = useState(null);
  const [trend, setTrend] = useState({ data: [], granularity: 'day' });
  const [comparison, setComparison] = useState([]);
  const [generalExpenses, setGeneralExpenses] = useState(0);

  const load = useCallback(async () => {
    const r = qs({ from: range.from, to: range.to });
    const [sum, tr, cmp, gen] = await Promise.all([
      api.get(`/analytics/summary${r}`),
      api.get(`/analytics/sales-trend${r}`),
      api.get(`/analytics/unit-comparison${r}`),
      api.get(`/expenses${qs({ general: true, from: range.from, to: range.to })}`),
    ]);
    setSummary(sum);
    setTrend(tr);
    setComparison(cmp);
    setGeneralExpenses(gen.reduce((s, e) => s + e.amount, 0));
  }, [range.from, range.to]);

  useEffect(() => {
    load().catch((e) => console.error(e));
  }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl text-mulata-800">General</h1>
        <p className="text-ink/50 text-sm">Vista consolidada del negocio Mulata</p>
      </div>

      <DateRangePicker preset={preset} range={range} onChange={(s) => { setPreset(s.preset); setRange(s.range); }} />

      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Ventas totales" value={summary.sales.value} variation={summary.sales.variation} />
          <KpiCard label="Gastos totales" value={summary.expenses.value} variation={summary.expenses.variation} />
          <KpiCard label="Beneficio neto" value={summary.profit.value} variation={summary.profit.variation} accent />
          <KpiCard label="Margen" value={summary.margin.value} variationPoints={summary.margin.variationPoints} format="percent" />
        </div>
      )}

      {/* Nota explicativa del cálculo global */}
      <div className="card bg-mulata-50/60 text-sm text-ink/70">
        <p>
          El beneficio neto ya incluye los <strong>Gastos Generales</strong> del periodo
          {' '}(<strong>{money(generalExpenses)}</strong>): compras a proveedores, contadora, tasas, etc.
        </p>
      </div>

      <SalesTrend data={trend.data} granularity={trend.granularity} />
      <UnitComparison data={comparison} />
    </div>
  );
}
