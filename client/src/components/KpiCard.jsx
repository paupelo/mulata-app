import { money, percent } from '../lib/format';

// Tarjeta KPI con valor destacado y variación vs periodo anterior.
export default function KpiCard({ label, value, variation, variationPoints, format = 'money', accent }) {
  const display = format === 'percent' ? percent(value) : money(value);
  const change = variationPoints !== undefined ? variationPoints : variation;
  const hasChange = change !== undefined && change !== null;
  const positive = change >= 0;

  return (
    <div className={`card animate-pop ${accent ? 'bg-mulata-600 text-white' : ''}`}>
      <p className={`text-sm ${accent ? 'text-white/80' : 'text-ink/60'}`}>{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? 'text-white' : 'text-ink'}`}>{display}</p>
      {hasChange && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <span
            className={`chip ${
              accent
                ? 'bg-white/20 text-white'
                : positive
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {positive ? '▲' : '▼'} {Math.abs(change)}
            {variationPoints !== undefined ? ' pts' : '%'}
          </span>
          <span className={accent ? 'text-white/70' : 'text-ink/40'}>vs. periodo anterior</span>
        </div>
      )}
    </div>
  );
}
