import { useMemo, useRef, useState } from 'react';
import { api } from '../api';
import { todayISO } from '../lib/format';
import BulkResult from './BulkResult';

function firstOfMonthISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}
function fmtISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function eachDay(start, end) {
  const out = [];
  if (!start || !end) return out;
  let d = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  if (isNaN(d.getTime()) || isNaN(e.getTime()) || d > e) return out;
  let guard = 0;
  while (d <= e && guard < 1000) {
    out.push(fmtISO(d));
    d.setDate(d.getDate() + 1);
    guard += 1;
  }
  return out;
}
function dayLabel(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Entrada rápida de ventas para tiendas (Megapolis / Casco): una fila por día
 * del rango elegido. props: unitCode, onClose, onSaved.
 */
export default function BulkSalesDays({ unitCode, onClose, onSaved }) {
  const [start, setStart] = useState(firstOfMonthISO());
  const [end, setEnd] = useState(todayISO());
  const [values, setValues] = useState({}); // { iso: { amount, note } }
  const [openNotes, setOpenNotes] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const inputs = useRef([]);

  const days = useMemo(() => eachDay(start, end), [start, end]);
  const filledCount = days.filter((d) => (values[d]?.amount ?? '') !== '').length;

  const setAmount = (iso, v) => setValues((p) => ({ ...p, [iso]: { ...p[iso], amount: v } }));
  const setNote = (iso, v) => setValues((p) => ({ ...p, [iso]: { ...p[iso], note: v } }));

  function onKeyDownAmount(e, idx) {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputs.current[idx + 1]?.focus();
    }
  }

  async function save() {
    setError('');
    if (days.length === 0) {
      setError('Elige un rango de fechas válido.');
      return;
    }
    const rows = days
      .filter((d) => (values[d]?.amount ?? '') !== '')
      .map((d) => ({ unit_code: unitCode, sale_date: d, amount: values[d].amount, note: values[d]?.note || '' }));
    if (rows.length === 0) {
      setError('Escribe el importe de al menos un día.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/sales/bulk', { rows });
      setResult(res);
      await onSaved?.();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  }

  if (result) return <BulkResult result={result} onClose={onClose} />;

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/60">
        Elige el rango de días y escribe el importe vendido cada día. Los días en blanco no se guardan;
        escribe <strong>0</strong> si ese día quieres registrarlo como sin ventas.
      </p>

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="label">Desde</label>
          <input type="date" className="input" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
        </div>
        <div className="flex-1">
          <label className="label">Hasta</label>
          <input type="date" className="input" value={end} min={start} onChange={(e) => setEnd(e.target.value)} />
        </div>
      </div>

      {days.length === 0 ? (
        <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
          Rango no válido: "Desde" debe ser anterior o igual a "Hasta".
        </p>
      ) : (
        <ul className="space-y-2 max-h-[46vh] overflow-y-auto pr-1">
          {days.map((iso, idx) => (
            <li key={iso} className="rounded-2xl bg-mulata-50 px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink/70 capitalize flex-1 min-w-0 truncate">{dayLabel(iso)}</span>
                <div className="relative w-32">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mulata-400">$</span>
                  <input
                    ref={(el) => (inputs.current[idx] = el)}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="input pl-7 py-2 text-right"
                    placeholder="—"
                    value={values[iso]?.amount ?? ''}
                    onChange={(e) => setAmount(iso, e.target.value)}
                    onKeyDown={(e) => onKeyDownAmount(e, idx)}
                    enterKeyHint="next"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setOpenNotes((p) => ({ ...p, [iso]: !p[iso] }))}
                  className={`h-8 w-8 shrink-0 grid place-items-center rounded-full text-sm ${
                    openNotes[iso] ? 'bg-mulata-600 text-white' : 'bg-white text-mulata-600'
                  }`}
                  aria-label="Nota del día"
                >
                  ✎
                </button>
              </div>
              {openNotes[iso] && (
                <input
                  type="text"
                  className="input py-2 mt-2 text-sm"
                  placeholder="Nota (opcional)"
                  value={values[iso]?.note ?? ''}
                  onChange={(e) => setNote(iso, e.target.value)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      <p className="text-sm text-ink/60">
        {days.length} día(s) · {filledCount} con importe
      </p>
      <div className="flex gap-3">
        <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="btn-primary flex-1" onClick={save} disabled={saving || filledCount === 0}>
          {saving ? 'Guardando…' : `Guardar ${filledCount || ''}`.trim()}
        </button>
      </div>
    </div>
  );
}
