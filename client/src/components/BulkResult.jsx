/**
 * Resumen visual del resultado de una entrada rápida masiva (ventas o gastos).
 * props: result = { inserted, skipped, empty, errors:[{index,reason}] }, onClose
 */
export default function BulkResult({ result, onClose }) {
  if (!result) return null;
  const { inserted = 0, skipped = 0, empty = 0, errors = [] } = result;

  return (
    <div className="space-y-3 rounded-2xl bg-mulata-50 p-4">
      <h3 className="text-base text-mulata-800">✅ Guardado completado</h3>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white py-3">
          <p className="text-2xl font-semibold text-green-700 tabular-nums">{inserted}</p>
          <p className="text-xs text-ink/60">guardadas</p>
        </div>
        <div className="rounded-xl bg-white py-3">
          <p className="text-2xl font-semibold text-amber-600 tabular-nums">{skipped}</p>
          <p className="text-xs text-ink/60">duplicadas</p>
        </div>
        <div className="rounded-xl bg-white py-3">
          <p className="text-2xl font-semibold text-ink/40 tabular-nums">{empty}</p>
          <p className="text-xs text-ink/60">vacías</p>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-xl bg-white px-3 py-2 text-sm">
          <p className="text-red-600 mb-1">{errors.length} con error:</p>
          <ul className="space-y-0.5 text-ink/70">
            {errors.map((e, i) => (
              <li key={i}>· {e.reason}</li>
            ))}
          </ul>
        </div>
      )}

      <button className="btn-primary w-full" onClick={onClose}>
        Cerrar
      </button>
    </div>
  );
}
