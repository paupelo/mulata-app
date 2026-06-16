import { useEffect, useState, useCallback } from 'react';
import { api, qs } from '../api';
import { getRange } from '../lib/dateRanges';
import { money } from '../lib/format';
import DateRangePicker from '../components/DateRangePicker';
import KpiCard from '../components/KpiCard';
import RecordList from '../components/RecordList';
import EntryForm from '../components/EntryForm';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import ExpenseBreakdown from '../components/charts/ExpenseBreakdown';
import BulkExpenses from '../components/BulkExpenses';

export default function GeneralExpenses() {
  const [preset, setPreset] = useState('this-month');
  const [range, setRange] = useState(getRange('this-month'));
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [breakdown, setBreakdown] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  const load = useCallback(async () => {
    const r = qs({ general: true, from: range.from, to: range.to });
    const [ex, cats, bd] = await Promise.all([
      api.get(`/expenses${r}`),
      api.get(`/categories${qs({ general: true })}`),
      api.get(`/analytics/expense-breakdown${r}`),
    ]);
    setExpenses(ex);
    setCategories(cats);
    setBreakdown(bd);
  }, [range.from, range.to]);

  useEffect(() => {
    load().catch((e) => console.error(e));
  }, [load]);

  async function handleSubmit(payload) {
    if (editing) await api.put(`/expenses/${editing.id}`, payload);
    else await api.post('/expenses', payload);
    setFormOpen(false);
    setEditing(null);
    await load();
  }
  async function handleDelete(record) {
    await api.del(`/expenses/${record.id}`);
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl text-mulata-800">🧾 Gastos Generales</h1>
        <p className="text-ink/50 text-sm">Compras a proveedores, contadora, tasas de la sociedad…</p>
      </div>

      <DateRangePicker preset={preset} range={range} onChange={(s) => { setPreset(s.preset); setRange(s.range); }} />

      <div className="grid grid-cols-1 gap-3">
        <KpiCard label="Total gastos generales del periodo" value={total} accent />
      </div>

      {/* Dos acciones diferenciadas: un gasto / entrada rápida de varios */}
      <div className="flex gap-2">
        <button
          className="btn-primary flex-1"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          ＋ Añadir gasto
        </button>
        <button className="btn-ghost flex-1" onClick={() => setBulkOpen(true)}>
          ⊞ Añadir varios
        </button>
      </div>

      <div className="flex justify-end">
        <button className="btn-ghost text-sm py-1.5" onClick={() => setCatModalOpen(true)}>
          ＋ Conceptos
        </button>
      </div>

      <RecordList
        records={expenses}
        type="expense"
        onEdit={(r) => {
          setEditing(r);
          setFormOpen(true);
        }}
        onDelete={(r) => setConfirm(r)}
        emptyText="Aún no hay gastos generales en este periodo."
      />

      {breakdown.length > 0 && <ExpenseBreakdown data={breakdown} />}

      {/* Entrada rápida: varios gastos generales a la vez */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Añadir varios gastos generales">
        <BulkExpenses
          context={{ general: true }}
          categories={categories}
          onClose={() => setBulkOpen(false)}
          onSaved={load}
        />
      </Modal>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={`${editing ? 'Editar' : 'Nuevo'} gasto general`}>
        <EntryForm
          type="expense"
          mode={editing ? 'edit' : 'create'}
          context={{ general: true }}
          initial={editing || {}}
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      <GeneralCategoryManager
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        categories={categories}
        onChanged={load}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => handleDelete(confirm)}
        title="Eliminar gasto"
        message={confirm ? `¿Eliminar este gasto de ${money(confirm.amount)}?` : ''}
      />
    </div>
  );
}

function GeneralCategoryManager({ open, onClose, categories, onChanged }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post('/categories', { name: name.trim(), kind: 'general' });
      setName('');
      await onChanged();
    } finally {
      setBusy(false);
    }
  }
  async function remove(id) {
    await api.del(`/categories/${id}`);
    await onChanged();
  }

  return (
    <Modal open={open} onClose={onClose} title="Conceptos de gastos generales">
      <form onSubmit={add} className="flex gap-2 mb-5">
        <input
          className="input"
          placeholder="Nuevo concepto (ej: Marketing)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn-primary px-5" disabled={busy}>
          ＋
        </button>
      </form>
      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-2xl bg-mulata-50 px-4 py-2.5">
            <span>{c.name}</span>
            {!c.is_default ? (
              <button onClick={() => remove(c.id)} className="text-red-500 text-sm">
                Eliminar
              </button>
            ) : (
              <span className="text-xs text-ink/30">predefinido</span>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
