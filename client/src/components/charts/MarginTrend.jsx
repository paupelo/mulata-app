import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { bucketLabel, percent } from '../../lib/format';

export default function MarginTrend({ data = [], granularity = 'day' }) {
  const chartData = data.map((d) => ({ ...d, label: bucketLabel(d.bucket, granularity) }));

  return (
    <div className="card">
      <h3 className="text-lg text-mulata-800 mb-1">Margen sobre ventas</h3>
      <p className="text-xs text-ink/50 mb-4">% de beneficio global en el tiempo</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData} margin={{ left: -10, right: 8, top: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1cdbf" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a7a80' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={(v) => v + '%'} tick={{ fontSize: 11, fill: '#8a7a80' }} tickLine={false} axisLine={false} width={40} />
          <Tooltip formatter={(v) => [percent(v), 'Margen']} />
          <Line type="monotone" dataKey="margin" stroke="#c65d44" strokeWidth={2.5} dot={{ r: 3, fill: '#c65d44' }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
