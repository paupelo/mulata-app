import { PRESETS, getRange } from '../lib/dateRanges';

// Selector de rango con presets + modo personalizado.
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
        <div className="flex items-center gap-2 animate-fade-in">
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
      )}
    </div>
  );
}
