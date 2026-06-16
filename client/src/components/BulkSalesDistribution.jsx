import { useState } from 'react';
import { api } from '../api';
import BulkResult from './BulkResult';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function monthLabel(m) {
  if (!m) return '';
  const [y, mo] = m.split('-');
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

/**
 * Entrada rápida de facturación de distribución: un mes y la lista de todos los
 * clientes, cada uno con su importe. La fecha de cada venta es el día 1 del mes
 * (misma convención que la entrada individual). props: clients, onClose, onSaved, onReload.
 */
export default function BulkSalesDistribution({ clients = [], onClose, onSaved, onReload }) {
  const [month, setMonth] = useState(currentMonth());
  const [values, setValues] = useState({}); // { clientId: amount }
  const [newClient, setNewClient] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const saleDate = month ? `${month}-01` : '';
  const filledCount = clients.filter((c) => (values[c.id] ?? '') !== '').length;
  const setAmount = (id, v) => setValues((p) => ({ ...p, [id]: v }));

  async function addClient() {
    const name = newClient.trim();
    if (!name) return;
    setAddingClient(true);
    setError('');
    try {
      await api.post('/clients', { name });
      setNewClient('');
      await onReload?.();
    } catch (err) {
      setError(err.message || 'No se pudo crear el cliente.');
    } finally {
      setAddingClient(false);
    }
  }

  async function save() {
    setError('');
    if (!month) {
      setError('Elige un mes.');
      return;
    }
    const rows = clients
      .filter((c) => (values[c.id] ?? '') !== '')
      .map((c) => ({ unit_code: 'distribucion', client_id: c.id, sale_date: saleDate, amount: values[c.id] }));
    if (rows.length === 0) {
      setError('Escribe lo facturado a al menos un cliente.');
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
        Elige el mes y escribe lo facturado a cada cliente. La fecha de cada venta será el día 1 de ese mes.
        Los clientes en blanco no se guardan.
      </p>

      <div>
        <label className="label">Mes</label>
        <input type="month" className="input" value={month} onChange={(e) => setMonth(e.target.value)} />
        <p className="text-xs text-ink/50 mt-1 capitalize">{monthLabel(month)}</p>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          className="input py-2"
          placeholder="Nuevo cliente (boutique)…"
          value={newClient}
          onChange={(e) => setNewClient(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addClient();
            }
          }}
        />
        <button type="button" className="btn-ghost px-4" onClick={addClient} disabled={addingClient || !newClient.trim()}>
          ＋
        </button>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-ink/60 text-center py-4">No hay clientes todavía. Añade uno arriba.</p>
      ) : (
        <ul className="space-y-2 max-h-[42vh] overflow-y-auto pr-1">
          {clients.map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-mulata-50 px-3 py-2">
              <span className="text-sm flex-1 min-w-0 truncate">{c.name}</span>
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-mulata-400">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="input pl-7 py-2 text-right"
                  placeholder="—"
                  value={values[c.id] ?? ''}
                  onChange={(e) => setAmount(c.id, e.target.value)}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
      <p className="text-sm text-ink/60">{filledCount} cliente(s) con importe</p>
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
