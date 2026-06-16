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
import BulkSalesDistribution from '../components/BulkSalesDistribution';

export default function Distribution() {
  const [preset, setPreset] = useState('this-year');
  const [range, setRange] = useState(getRange('this-year'));
  const [summary, setSummary] = useState(null);
  const [clients, setClients] = useState([]);
  const [sales, setSales] = useState([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editingSale, setEditingSale] = useState(null);
  const [clientModal, setClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    const r = qs({ unit: 'distribucion', from: range.from, to: range.to });
    const [sum, cl, sl] = await Promise.all([
      api.get(`/analytics/summary${qs({ unit: 'distribucion', from: range.from, to: range.to })}`),
      api.get('/clients'),
      api.get(`/sales${r}`),
    ]);
    setSummary(sum);
    setClients(cl);
    setSales(sl);
  }, [range.from, range.to]);

  useEffect(() => {
    load().catch((e) => console.error(e));
  }, [load]);

  async function handleSaleSubmit(payload) {
    if (editingSale) await api.put(`/sales/${editingSale.id}`, payload);
    else await api.post('/sales', payload);
    setFormOpen(false);
    setEditingSale(null);
    await load();
  }
  async function deleteSale(record) {
    await api.del(`/sales/${record.id}`);
    await load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl text-mulata-800">📦 Distribución</h1>
        <p className="text-ink/50 text-sm">Facturación a boutiques y consignaciones</p>
      </div>

      <DateRangePicker preset={preset} range={range} onChange={(s) => { setPreset(s.preset); setRange(s.range); }} />

      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <KpiCard label="Facturado" value={summary.sales.value} variation={summary.sales.variation} />
          <KpiCard label="Beneficio" value={summary.profit.value} variation={summary.profit.variation} accent />
        </div>
      )}

      {/* Clientes de distribución */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg text-mulata-800">Clientes</h2>
        <button
          className="btn-ghost text-sm py-1.5"
          onClick={() => {
            setEditingClient(null);
            setClientModal(true);
          }}
        >
          ＋ Cliente
        </button>
      </div>

      {clients.length === 0 ? (
        <div className="card text-center text-ink/50 py-8">Aún no hay clientes de distribución.</div>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {clients.map((c) => (
            <li key={c.id} className="card flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium truncate">{c.name}</p>
                <p className="text-xs text-ink/50 truncate">
                  {c.contact || 'Sin contacto'} · Total: {money(c.total_billed)}
                </p>
              </div>
              <button
                onClick={() => {
                  setEditingClient(c);
                  setClientModal(true);
                }}
                className="h-8 w-8 grid place-items-center rounded-full bg-mulata-50 text-mulata-700"
                aria-label="Editar cliente"
              >
                ✎
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Facturación registrada */}
      <h2 className="text-lg text-mulata-800 pt-2">Facturación registrada</h2>

      {/* Dos acciones diferenciadas: una factura / entrada rápida del mes */}
      <div className="flex gap-2">
        <button
          className="btn-primary flex-1"
          onClick={() => {
            setEditingSale(null);
            setFormOpen(true);
          }}
        >
          ＋ Añadir facturación
        </button>
        <button className="btn-ghost flex-1" onClick={() => setBulkOpen(true)}>
          ⊞ Añadir varias
        </button>
      </div>

      <RecordList
        records={sales}
        type="sale"
        onEdit={(r) => {
          setEditingSale(r);
          setFormOpen(true);
        }}
        onDelete={(r) => setConfirm(r)}
        emptyText="Aún no hay facturación de distribución en este periodo."
      />

      {/* Entrada rápida: facturación del mes para todos los clientes */}
      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Añadir varias · Facturación del mes">
        <BulkSalesDistribution
          clients={clients}
          onClose={() => setBulkOpen(false)}
          onSaved={load}
          onReload={load}
        />
      </Modal>

      {/* Alta/edición de facturación */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={`${editingSale ? 'Editar' : 'Nueva'} facturación de distribución`}
      >
        {clients.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-ink/60 mb-4">Primero crea al menos un cliente de distribución.</p>
            <button
              className="btn-primary"
              onClick={() => {
                setFormOpen(false);
                setEditingClient(null);
                setClientModal(true);
              }}
            >
              ＋ Crear cliente
            </button>
          </div>
        ) : (
          <EntryForm
            type="sale"
            mode={editingSale ? 'edit' : 'create'}
            context={{ distribution: true }}
            initial={editingSale || { sale_date: monthStart() }}
            clients={clients}
            onSubmit={handleSaleSubmit}
            onCancel={() => setFormOpen(false)}
          />
        )}
      </Modal>

      {/* Alta/edición de cliente */}
      <ClientModal
        open={clientModal}
        onClose={() => setClientModal(false)}
        client={editingClient}
        onSaved={load}
        onDelete={(c) => setConfirm({ ...c, _isClient: true })}
      />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          if (confirm._isClient) {
            await api.del(`/clients/${confirm.id}`);
            setClientModal(false);
          } else {
            await deleteSale(confirm);
          }
          await load();
        }}
        title={confirm?._isClient ? 'Eliminar cliente' : 'Eliminar facturación'}
        message={
          confirm?._isClient
            ? `¿Eliminar el cliente "${confirm.name}"? Su facturación histórica se conservará sin cliente asignado.`
            : confirm
            ? `¿Eliminar este registro de ${money(confirm.amount)}?`
            : ''
        }
      />
    </div>
  );
}

function monthStart() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/** Modal para crear/editar un cliente de distribución. */
function ClientModal({ open, onClose, client, onSaved, onDelete }) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(client?.name || '');
    setContact(client?.contact || '');
  }, [client, open]);

  async function save(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (client) await api.put(`/clients/${client.id}`, { name: name.trim(), contact });
      else await api.post('/clients', { name: name.trim(), contact });
      onClose();
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={client ? 'Editar cliente' : 'Nuevo cliente'}>
      <form onSubmit={save} className="space-y-4">
        <div>
          <label className="label">Nombre de la boutique</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </div>
        <div>
          <label className="label">Contacto (opcional)</label>
          <input
            className="input"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="Teléfono, email o persona"
          />
        </div>
        <div className="flex gap-3">
          {client && (
            <button type="button" className="btn-danger" onClick={() => onDelete(client)}>
              Eliminar
            </button>
          )}
          <button type="submit" className="btn-primary flex-1" disabled={busy}>
            {busy ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
