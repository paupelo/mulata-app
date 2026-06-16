import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { bucketLabel, money, moneyShort } from '../../lib/format';

const SERIES = [
  { key: 'megapolis', name: 'Megapolis', color: '#a8456b' },
  { key: 'casco', name: 'Casco Antiguo', color: '#d67e63' },
  { key: 'distribucion', name: 'Distribución', color: '#6f2a47' },
  { key: 'global', name: 'Global', color: '#3b2d33' },
];

export default function ProfitTrend({ data = [], granularity = 'day' }) {
  const chartData = data.map((d) => ({ ...d, label: bucketLabel(d.bucket, granularity) }));

  return (
    <div className="card">
      <h3 className="text-lg text-mulata-800 mb-1">Beneficio neto por unidad</h3>
      <p className="text-xs text-ink/50 mb-4">Ventas − gastos de cada unidad</p>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ left: -10, right: 8, top: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1cdbf" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a7a80' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11, fill: '#8a7a80' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(v, n) => [money(v), n]} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {SERIES.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.key === 'global' ? 3 : 2}
              dot={false}
              strokeDasharray={s.key === 'global' ? '6 3' : undefined}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
