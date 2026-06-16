import { useState } from 'react';
import { api } from '../api';
import { todayISO } from '../lib/format';
import BulkResult from './BulkResult';

let _seq = 0;
function blankRow(general) {
  return {
    _k: ++_seq,
    date: todayISO(),
    category_id: '',
    concept: '',
    amount: '',
    kind: general ? 'general' : 'fijo',
    supplier: '',
  };
}

/**
 * Entrada rápida de varios gastos. Filas dinámicas.
 * props: context = { unitCode } (tienda) | { general: true }, categories, onClose, onSaved.
 */
export default function BulkExpenses({ context = {}, categories = [], onClose, onSaved }) {
  const general = !!context.general;
  const [rows, setRows] = useState(() => [blankRow(general), blankRow(general), blankRow(general)]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const update = (k, field, v) => setRows((rs) => rs.map((r) => (r._k === k ? { ...r, [field]: v } : r)));
  const addRow = () => setRows((rs) => [...rs, blankRow(general)]);
  const removeRow = (k) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r._k !== k) : rs));

  const filledCount = rows.filter((r) => r.amount !== '').length;

  async function save() {
    setError('');
    const payload = rows
      .filter((r) => r.amount !== '')
      .map((r) => {
        const base = {
          expense_date: r.date,
          amount: r.amount,
          category_id: r.category_id || null,
          concept: r.concept || '',
        };
        if (general) return { ...base, supplier: r.supplier || '', kind: 'general' };
        return { ...base, unit_code: context.unitCode, kind: r.kind };
      });
    if (payload.length === 0) {
      setError('Escribe el importe de al menos un gasto.');
      return;
    }
    setSaving(true);
    try {
      const res = await api.post('/expenses/bulk', { rows: payload });
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
        Añade varios gastos de una vez. Las filas sin importe se ignoran.
      </p>

      <ul className="space-y-3 max-h-[52vh] overflow-y-auto pr-1">
        {rows.map((r) => (
          <li key={r._k} className="rounded-2xl bg-mulata-50 p-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="date"
                className="input py-2 text-sm flex-1"
                value={r.date}
                onChange={(e) => update(r._k, 'date', e.target.value)}
              />
              <div className="relative w-28">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mulata-400">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="input pl-7 py-2 text-right"
                  placeholder="0.00"
                  value={r.amount}
                  onChange={(e) => update(r._k, 'amount', e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <select
                className="input py-2 text-sm flex-1"
                value={r.category_id}
                onChange={(e) => update(r._k, 'category_id', e.target.value)}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {!general && (
                <select
                  className="input py-2 text-sm w-40"
                  value={r.kind}
                  onChange={(e) => update(r._k, 'kind', e.target.value)}
                >
                  <option value="fijo">fijo</option>
                  <option value="extraordinario">extraordinario</option>
                </select>
              )}
            </div>

            <input
              type="text"
              className="input py-2 text-sm"
              placeholder={general ? 'Descripción (ej: Compra temporada)' : 'Descripción (ej: QUINCENA LORENA)'}
              value={r.concept}
              onChange={(e) => update(r._k, 'concept', e.target.value)}
            />

            {general && (
              <input
                type="text"
                className="input py-2 text-sm"
                placeholder="Proveedor (opcional)"
                value={r.supplier}
                onChange={(e) => update(r._k, 'supplier', e.target.value)}
              />
            )}

            <div className="text-right">
              <button type="button" className="text-red-500 text-xs" onClick={() => removeRow(r._k)}>
                Quitar fila
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button type="button" className="btn-ghost w-full" onClick={addRow}>
        ＋ Añadir otra fila
      </button>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      <p className="text-sm text-ink/60">{filledCount} gasto(s) con importe</p>
      <div className="flex gap-3">
        <button type="button" className="btn-ghost flex-1" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="btn-primary flex-1" onClick={save} disabled={saving || filledCount === 0}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
