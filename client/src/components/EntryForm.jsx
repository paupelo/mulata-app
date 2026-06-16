import { useState } from 'react';
import { todayISO } from '../lib/format';

/**
 * Formulario reutilizable para crear/editar ventas y gastos.
 *
 * props:
 *  - type: 'sale' | 'expense'
 *  - mode: 'create' | 'edit'
 *  - context: { unitCode?, general?, distribution? }  — fija el ámbito del registro
 *  - initial: valores iniciales (para editar)
 *  - categories: [{id,name,kind}]  — solo gastos
 *  - clients: [{id,name}]          — solo distribución
 *  - onSubmit(payload), onCancel()
 */
export default function EntryForm({ type, mode = 'create', context = {}, initial = {}, categories = [], clients = [], onSubmit, onCancel }) {
  const isSale = type === 'sale';
  const [amount, setAmount] = useState(initial.amount ?? '');
  const [date, setDate] = useState(initial.sale_date || initial.expense_date || todayISO());
  const [note, setNote] = useState(initial.note ?? '');
  const [clientId, setClientId] = useState(initial.client_id ?? '');
  const [categoryId, setCategoryId] = useState(initial.category_id ?? '');
  const [concept, setConcept] = useState(initial.concept ?? '');
  const [supplier, setSupplier] = useState(initial.supplier ?? '');
  const [kind, setKind] = useState(initial.kind ?? (context.general ? 'general' : 'fijo'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (amount === '' || Number(amount) < 0) {
      setError('Introduce un importe válido.');
      return;
    }
    if (isSale && context.distribution && !clientId) {
      setError('Selecciona el cliente de distribución.');
      return;
    }

    const payload = { amount: Number(amount) };
    if (isSale) {
      payload.sale_date = date;
      payload.note = note;
      if (context.distribution) {
        payload.unit_code = 'distribucion';
        payload.client_id = Number(clientId);
      } else {
        payload.unit_code = context.unitCode;
      }
    } else {
      payload.expense_date = date;
      payload.note = note;
      payload.category_id = categoryId ? Number(categoryId) : null;
      payload.concept = concept;
      if (context.general) {
        payload.supplier = supplier;
        payload.kind = 'general';
      } else {
        payload.unit_code = context.unitCode;
        payload.kind = kind;
      }
    }

    setBusy(true);
    try {
      await onSubmit(payload);
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Importe — protagonista del formulario, fácil de tocar con una mano */}
      <div>
        <label className="label">Importe (USD)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-mulata-400 text-lg">$</span>
          <input
            className="input pl-9 text-2xl font-semibold"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            autoFocus
          />
        </div>
      </div>

      <div>
        <label className="label">Fecha</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>

      {/* Distribución: selector de cliente */}
      {isSale && context.distribution && (
        <div>
          <label className="label">Cliente (boutique)</label>
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">Selecciona…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Gastos: categoría + tipo */}
      {!isSale && (
        <>
          <div>
            <label className="label">Concepto / categoría</label>
            <select className="input" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.kind ? ` · ${c.kind}` : ''}
                </option>
              ))}
            </select>
          </div>

          {!context.general && (
            <div>
              <label className="label">Tipo de gasto</label>
              <div className="flex gap-2">
                {['fijo', 'extraordinario'].map((k) => (
                  <button
                    type="button"
                    key={k}
                    onClick={() => setKind(k)}
                    className={`chip flex-1 justify-center py-2 capitalize ${
                      kind === k ? 'bg-mulata-600 text-white' : 'bg-mulata-50 text-mulata-700'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="label">Descripción {context.general ? '' : '(opcional)'}</label>
            <input
              className="input"
              type="text"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder={context.general ? 'Ej: Compra de ropa temporada' : 'Ej: Exhibidor de gafas'}
            />
          </div>

          {context.general && (
            <div>
              <label className="label">Proveedor (opcional)</label>
              <input
                className="input"
                type="text"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder="Ej: Textiles Panamá S.A."
              />
            </div>
          )}
        </>
      )}

      {/* Nota opcional para ventas */}
      {isSale && (
        <div>
          <label className="label">Nota (opcional)</label>
          <input
            className="input"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: día de lluvia, evento…"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Guardando…' : mode === 'edit' ? 'Guardar cambios' : 'Añadir'}
        </button>
      </div>
    </form>
  );
}
