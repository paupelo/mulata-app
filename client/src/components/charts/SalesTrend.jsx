import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { bucketLabel, money, moneyShort } from '../../lib/format';

export default function SalesTrend({ data = [], granularity = 'day' }) {
  const chartData = data.map((d) => ({ ...d, label: bucketLabel(d.bucket, granularity) }));

  return (
    <div className="card">
      <h3 className="text-lg text-mulata-800 mb-1">Evolución de ventas</h3>
      <p className="text-xs text-ink/50 mb-4">Agrupado por {labelFor(granularity)}</p>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={chartData} margin={{ left: -10, right: 8, top: 4 }}>
          <defs>
            <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#a8456b" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#a8456b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1cdbf" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a7a80' }} tickLine={false} axisLine={false} />
          <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11, fill: '#8a7a80' }} tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(v) => [money(v), 'Ventas']} labelStyle={{ color: '#3b2d33' }} />
          <Area type="monotone" dataKey="sales" stroke="#a8456b" strokeWidth={2.5} fill="url(#salesFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function labelFor(g) {
  return g === 'month' ? 'mes' : g === 'week' ? 'semana' : 'día';
}
