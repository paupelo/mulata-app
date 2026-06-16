import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { money, moneyShort } from '../../lib/format';

export default function UnitComparison({ data = [] }) {
  const chartData = data.map((d) => ({
    name: d.name,
    Ventas: d.sales,
    Gastos: d.expenses,
    Beneficio: d.profit,
  }));

  return (
    <div className="card">
      <h3 className="text-lg text-mulata-800 mb-1">Comparativa entre unidades</h3>
      <p className="text-xs text-ink/50 mb-4">Ventas, gastos y beneficio del periodo</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={chartData} margin={{ left: -10, right: 8, top: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1cdbf" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8a7a80' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11, fill: '#8a7a80' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(v, n) => [money(v), n]} cursor={{ fill: '#f9e8e0' }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Ventas" fill="#a8456b" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Gastos" fill="#e6a892" radius={[6, 6, 0, 0]} />
          <Bar dataKey="Beneficio" fill="#6f2a47" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
