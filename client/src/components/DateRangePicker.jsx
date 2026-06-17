import { PRESETS, getRange, recentMonths } from '../lib/dateRanges';

// Meses naturales recientes para el selector personalizado (últimos 12).
const MONTHS = recentMonths(12);

// Selector de rango con presets + modo personalizado (meses naturales o fechas concretas).
export default function DateRangePicker({ preset, range, onChange }) {
  function selectPreset(key) {
    if (key === 'custom') {
      onChange({ preset: 'custom', range });
    } else {
      onChange({ preset: key, range: getRange(key) });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => selectPreset(p.key)}
            className={`chip whitespace-nowrap px-3 py-1.5 transition ${
              preset === p.key ? 'bg-mulata-600 text-white' : 'bg-mulata-50 text-mulata-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {preset === 'custom' && (
        <div className="space-y-3 animate-fade-in">
          {/* Meses naturales: un toque selecciona el mes completo */}
          <div>
            <p className="label mb-1.5">Elige un mes</p>
            <div className="flex flex-wrap gap-2">
              {MONTHS.map((mo) => {
                const active = range.from === mo.range.from && range.to === mo.range.to;
                return (
                  <button
                    key={mo.key}
                    onClick={() => onChange({ preset: 'custom', range: mo.range })}
                    className={`chip px-3 py-1.5 capitalize transition ${
                      active ? 'bg-mulata-600 text-white' : 'bg-white text-mulata-700 shadow-card'
                    }`}
                  >
                    {mo.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fechas concretas */}
          <div>
            <p className="label mb-1.5">O fechas concretas</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="input py-2 text-sm"
                value={range.from}
                onChange={(e) => onChange({ preset: 'custom', range: { ...range, from: e.target.value } })}
              />
              <span className="text-ink/40">→</span>
              <input
                type="date"
                className="input py-2 text-sm"
                value={range.to}
                onChange={(e) => onChange({ preset: 'custom', range: { ...range, to: e.target.value } })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
