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
import BulkSalesDays from '../components/BulkSalesDays';
import BulkExpenses from '../components/BulkExpenses';

/**
 * Página de una tienda física. Reutilizada por Megapolis y Casco Antiguo.
 * props: unitCode, title, emoji
 */
export default function StorePage({ unitCode, title, emoji }) {
  const [preset, setPreset] = useState('this-month');
  const [range, setRange] = useState(getRange('this-month'));
  const [tab, setTab] = useState('ventas'); // ventas | gastos
  const [summary, setSummary] = useState(null);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [breakdown, setBreakdown] = useState([]);

  // Estado de modales
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    const range_qs = qs({ unit: unitCode, from: range.from, to: range.to });
    const [sum, sl, ex, cats, bd] = await Promise.all([
      api.get(`/analytics/summary${qs({ unit: unitCode, from: range.from, to: range.to })}`),
      api.get(`/sales${range_qs}`),
      api.get(`/expenses${range_qs}`),
      api.get(`/categories${qs({ unit: unitCode })}`),
      api.get(`/analytics/expense-breakdown${range_qs}`),
    ]);
    setSummary(sum);
    setSales(sl);
    setExpenses(ex);
    setCategories(cats);
    setBreakdown(bd);
  }, [unitCode, range.from, range.to]);

  useEffect(() => {
    load().catch((e) => console.error(e));
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(record) {
    setEditing(record);
    setFormOpen(true);
  }

  async function handleSubmit(payload) {
    const isSale = tab === 'ventas';
    const base = isSale ? '/sales' : '/expenses';
    if (editing) await api.put(`${base}/${editing.id}`, payload);
    else await api.post(base, payload);
    setFormOpen(false);
    setEditing(null);
    await load();
  }

  async function handleDelete(record) {
    const base = tab === 'ventas' ? '/sales' : '/expenses';
    await api.del(`${base}/${record.id}`);
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl text-mulata-800">
          {emoji} {title}
        </h1>
        <p className="text-ink/50 text-sm">Ventas y gastos de la tienda</p>
      </div>

      <DateRangePicker preset={preset} range={range} onChange={(s) => { setPreset(s.preset); setRange(s.range); }} />

      {/* KPIs de la tienda */}
      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Ventas" value={summary.sales.value} variation={summary.sales.variation} />
          <KpiCard label="Gastos" value={summary.expenses.value} variation={summary.expenses.variation} />
          <KpiCard label="Beneficio" value={summary.profit.value} variation={summary.profit.variation} accent />
          <KpiCard label="Margen" value={summary.margin.value} variationPoints={summary.margin.variationPoints} format="percent" />
        </div>
      )}

      {/* Pestañas ventas / gastos */}
      <div className="flex gap-2">
        {[
          { k: 'ventas', label: 'Ventas' },
          { k: 'gastos', label: 'Gastos' },
        ].map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`chip flex-1 justify-center py-2.5 text-sm ${
              tab === t.k ? 'bg-mulata-600 text-white' : 'bg-white text-ink/60 shadow-card'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Dos acciones diferenciadas: añadir uno / entrada rápida de varios */}
      <div className="flex gap-2">
        <button className="btn-primary flex-1" onClick={openCreate}>
          ＋ {tab === 'ventas' ? 'Añadir venta' : 'Añadir gasto'}
        </button>
        <button className="btn-ghost flex-1" onClick={() => setBulkOpen(true)}>
          ⊞ {tab === 'ventas' ? 'Añadir varias' : 'Añadir varios'}
        </button>
      </div>

      {tab === 'ventas' ? (
        <RecordList
          records={sales}
          type="sale"
          onEdit={openEdit}
          onDelete={(r) => setConfirm(r)}
          emptyText="Aún no hay ventas registradas en este periodo."
        />
      ) : (
        <>
          <div className="flex justify-end">
            <button className="btn-ghost text-sm py-1.5" onClick={() => setCatModalOpen(true)}>
              ＋ Conceptos
            </button>
          </div>
          <RecordList
            records={expenses}
            type="expense"
            onEdit={openEdit}
            onDelete={(r) => setConfirm(r)}
            emptyText="Aún no hay gastos registrados en este periodo."
          />
          {breakdown.length > 0 && <ExpenseBreakdown data={breakdown} />}
        </>
      )}

      {/* Modal de alta/edición */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={`${editing ? 'Editar' : 'Nueva'} ${tab === 'ventas' ? 'venta' : 'gasto'} · ${title}`}
      >
        <EntryForm
          type={tab === 'ventas' ? 'sale' : 'expense'}
          mode={editing ? 'edit' : 'create'}
          context={{ unitCode }}
          initial={editing || {}}
          categories={categories}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
        />
      </Modal>

      {/* Entrada rápida de varios registros */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title={`Añadir ${tab === 'ventas' ? 'varias ventas' : 'varios gastos'} · ${title}`}
      >
        {tab === 'ventas' ? (
          <BulkSalesDays unitCode={unitCode} onClose={() => setBulkOpen(false)} onSaved={load} />
        ) : (
          <BulkExpenses
            context={{ unitCode }}
            categories={categories}
            onClose={() => setBulkOpen(false)}
            onSaved={load}
          />
        )}
      </Modal>

      {/* Gestión de conceptos de gasto */}
      <CategoryManager
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        unitCode={unitCode}
        categories={categories}
        onChanged={load}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => handleDelete(confirm)}
        title="Eliminar registro"
        message={confirm ? `¿Seguro que quieres eliminar este registro de ${money(confirm.amount)}?` : ''}
      />
    </div>
  );
}

/** Sub-componente: crear/borrar conceptos de gasto personalizados de la tienda. */
function CategoryManager({ open, onClose, unitCode, categories, onChanged }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState('fijo');
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post('/categories', { name: name.trim(), unit_code: unitCode, kind });
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
    <Modal open={open} onClose={onClose} title="Conceptos de gasto">
      <form onSubmit={add} className="space-y-3 mb-5">
        <input
          className="input"
          placeholder="Nuevo concepto (ej: Seguridad)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
        <button className="btn-primary w-full" disabled={busy}>
          Añadir concepto
        </button>
      </form>

      <ul className="space-y-2">
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-2xl bg-mulata-50 px-4 py-2.5">
            <span>
              {c.name} <span className="text-xs text-ink/40">· {c.kind}</span>
            </span>
            {!c.is_default && (
              <button onClick={() => remove(c.id)} className="text-red-500 text-sm">
                Eliminar
              </button>
            )}
            {c.is_default && <span className="text-xs text-ink/30">predefinido</span>}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
