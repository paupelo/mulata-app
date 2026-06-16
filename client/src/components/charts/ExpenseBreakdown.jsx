import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { money } from '../../lib/format';

const COLORS = ['#a8456b', '#d67e63', '#6f2a47', '#e6a892', '#c65d44', '#8a3557', '#f1cdbf', '#4d1d31'];

export default function ExpenseBreakdown({ data = [] }) {
  const chartData = data.filter((d) => d.amount > 0);
  const total = chartData.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="card">
      <h3 className="text-lg text-mulata-800 mb-1">Desglose de gastos</h3>
      <p className="text-xs text-ink/50 mb-4">Por categoría en el periodo</p>
      {chartData.length === 0 ? (
        <p className="text-center text-ink/50 py-10">Sin gastos en este periodo.</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="amount"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={95}
              paddingAngle={2}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => [`${money(v)} (${((v / total) * 100).toFixed(1)}%)`, 'Gasto']}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
