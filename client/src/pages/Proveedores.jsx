import { useEffect, useState, useCallback } from 'react';
import { api, qs } from '../api';
import { getRange } from '../lib/dateRanges';
import { money, formatDate, todayISO } from '../lib/format';
import DateRangePicker from '../components/DateRangePicker';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

// Etiquetas legibles de las unidades de negocio.
const UNIDADES = [
  { code: 'megapolis', label: 'Megapolis' },
  { code: 'casco', label: 'Casco Antiguo' },
  { code: 'distribucion', label: 'Distribución' },
];
const UNIDAD_LABEL = Object.fromEntries(UNIDADES.map((u) => [u.code, u.label]));

export default function Proveedores() {
  const [tab, setTab] = useState('compras'); // compras | proveedores
  const [preset, setPreset] = useState('this-year');
  const [range, setRange] = useState(getRange('this-year'));

  const [compras, setCompras] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [resumen, setResumen] = useState(null);

  const load = useCallback(async () => {
    const r = qs({ desde: range.from, hasta: range.to });
    const [cps, prov, cli, res] = await Promise.all([
      api.get(`/compras${r}`),
      api.get('/proveedores'),
      api.get('/clients'),
      api.get(`/proveedores/resumen${r}`),
    ]);
    setCompras(cps);
    setProveedores(prov);
    setClientes(cli);
    setResumen(res);
  }, [range.from, range.to]);

  useEffect(() => {
    load().catch((e) => console.error(e));
  }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl text-mulata-800">🚚 Proveedores</h1>
        <p className="text-ink/50 text-sm">Compras a proveedores y reparto a las unidades</p>
      </div>

      {/* Pestañas */}
      <div className="flex gap-2">
        {[
          { k: 'compras', label: 'Compras' },
          { k: 'proveedores', label: 'Proveedores' },
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

      {tab === 'compras' ? (
        <ComprasTab
          compras={compras}
          proveedores={proveedores}
          clientes={clientes}
          resumen={resumen}
          preset={preset}
          range={range}
          onRangeChange={(s) => {
            setPreset(s.preset);
            setRange(s.range);
          }}
          onChanged={load}
        />
      ) : (
        <ProveedoresTab proveedores={proveedores} onChanged={load} />
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pestaña COMPRAS
 * ────────────────────────────────────────────────────────────────────────── */
function ComprasTab({ compras, proveedores, clientes, resumen, preset, range, onRangeChange, onChanged }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  return (
    <div className="space-y-4">
      <DateRangePicker preset={preset} range={range} onChange={onRangeChange} />

      {/* Resumen de gasto imputado por unidad */}
      {resumen && (
        <div className="card bg-mulata-50/60">
          <p className="text-sm text-ink/60 mb-2">Gasto imputado por unidad en el periodo</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {UNIDADES.map((u) => (
              <div key={u.code} className="rounded-2xl bg-white px-2 py-2 shadow-card">
                <p className="text-xs text-ink/50 truncate">{u.label}</p>
                <p className="font-semibold text-mulata-700 tabular-nums">{money(resumen.unidades[u.code])}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn-primary w-full"
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
      >
        ＋ Nueva compra
      </button>

      {compras.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">
          <p className="text-3xl mb-2">🧾</p>
          <p>Aún no hay compras registradas en este periodo.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {compras.map((c) => (
            <CompraItem
              key={c.id}
              compra={c}
              clientes={clientes}
              expanded={expandedId === c.id}
              onToggle={() => setExpandedId(expandedId === c.id ? null : c.id)}
              onEdit={() => {
                setEditing(c);
                setFormOpen(true);
              }}
              onDelete={() => setConfirm(c)}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}

      {/* Alta / edición de compra */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? 'Editar compra' : 'Nueva compra'}
      >
        <CompraForm
          proveedores={proveedores}
          initial={editing}
          onCancel={() => setFormOpen(false)}
          onSaved={async () => {
            setFormOpen(false);
            setEditing(null);
            await onChanged();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await api.del(`/compras/${confirm.id}`);
          await onChanged();
        }}
        title="Eliminar compra"
        message={
          confirm
            ? `¿Eliminar la compra "${confirm.concepto}" de ${money(confirm.importe_total)}? Se borrarán también sus asignaciones.`
            : ''
        }
      />
    </div>
  );
}

/** Fila de compra expandible con asignaciones. */
function CompraItem({ compra, clientes, expanded, onToggle, onEdit, onDelete, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [confirmAsig, setConfirmAsig] = useState(null);

  const pendiente = compra.importe_total - compra.importe_asignado;

  const loadDetail = useCallback(async () => {
    const d = await api.get(`/compras/${compra.id}`);
    setDetail(d);
  }, [compra.id]);

  useEffect(() => {
    if (expanded) loadDetail().catch((e) => console.error(e));
  }, [expanded, loadDetail]);

  return (
    <li className="card animate-fade-in">
      <div className="flex items-center gap-3">
        <button className="flex-1 min-w-0 text-left" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <p className="font-medium truncate">{compra.concepto}</p>
            <span className="text-xs text-ink/40">{expanded ? '▲' : '▼'}</span>
          </div>
          <p className="text-xs text-ink/50 truncate">
            {formatDate(compra.fecha)} · {compra.proveedor_nombre || 'Sin proveedor'}
            {compra.cantidad_unidades ? ` · ${compra.cantidad_unidades} ud.` : ''}
          </p>
        </button>
        <div className="text-right">
          <p className="font-semibold tabular-nums text-mulata-700">{money(compra.importe_total)}</p>
          <p className={`text-[11px] tabular-nums ${pendiente > 0.005 ? 'text-amber-600' : 'text-green-600'}`}>
            {pendiente > 0.005 ? `Pend. ${money(pendiente)}` : 'Asignado'}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="h-8 w-8 grid place-items-center rounded-full bg-mulata-50 text-mulata-700 active:scale-90 transition"
            aria-label="Editar"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            className="h-8 w-8 grid place-items-center rounded-full bg-red-50 text-red-500 active:scale-90 transition"
            aria-label="Eliminar"
          >
            🗑
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t border-mulata-50 pt-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-ink/50">
            <span>Asignado: {money(compra.importe_asignado)}</span>
            <span>Pendiente: {money(pendiente)}</span>
          </div>

          {detail?.asignaciones?.length ? (
            <ul className="space-y-1.5">
              {detail.asignaciones.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-2xl bg-mulata-50 px-3 py-2 text-sm"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {UNIDAD_LABEL[a.unidad] || a.unidad}
                      {a.cliente_nombre ? ` · ${a.cliente_nombre}` : ''}
                    </p>
                    <p className="text-[11px] text-ink/50 truncate">
                      {formatDate(a.fecha)}
                      {a.unidades_tomadas ? ` · ${a.unidades_tomadas} ud.` : ''}
                      {a.nota ? ` · ${a.nota}` : ''}
                    </p>
                  </div>
                  <span className="tabular-nums font-medium text-mulata-700">{money(a.importe_asignado)}</span>
                  <button
                    onClick={() => setConfirmAsig(a)}
                    className="h-7 w-7 grid place-items-center rounded-full bg-red-50 text-red-500 active:scale-90 transition"
                    aria-label="Eliminar asignación"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink/40">Sin asignaciones todavía.</p>
          )}

          <button className="btn-ghost w-full text-sm py-2" onClick={() => setAsignarOpen(true)}>
            ＋ Asignar a unidad
          </button>
        </div>
      )}

      {/* Modal de asignación */}
      <Modal open={asignarOpen} onClose={() => setAsignarOpen(false)} title="Asignar a unidad">
        <AsignarForm
          compra={compra}
          clientes={clientes}
          onCancel={() => setAsignarOpen(false)}
          onSaved={async () => {
            setAsignarOpen(false);
            await loadDetail();
            await onChanged();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirmAsig}
        onClose={() => setConfirmAsig(null)}
        onConfirm={async () => {
          await api.del(`/asignaciones/${confirmAsig.id}`);
          await loadDetail();
          await onChanged();
        }}
        title="Eliminar asignación"
        message={
          confirmAsig
            ? `¿Eliminar la imputación de ${money(confirmAsig.importe_asignado)} a ${
                UNIDAD_LABEL[confirmAsig.unidad] || confirmAsig.unidad
              }?`
            : ''
        }
      />
    </li>
  );
}

/** Formulario de alta/edición de compra. */
function CompraForm({ proveedores, initial, onCancel, onSaved }) {
  const [proveedorId, setProveedorId] = useState(initial?.proveedor_id ?? '');
  const [fecha, setFecha] = useState(initial?.fecha || todayISO());
  const [concepto, setConcepto] = useState(initial?.concepto ?? '');
  const [cantidad, setCantidad] = useState(initial?.cantidad_unidades ?? '');
  const [importe, setImporte] = useState(initial?.importe_total ?? '');
  const [nota, setNota] = useState(initial?.nota ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!proveedorId) return setError('Selecciona un proveedor.');
    if (!concepto.trim()) return setError('Indica un concepto.');
    if (importe === '' || Number(importe) < 0) return setError('Introduce un importe válido.');

    const payload = {
      proveedor_id: Number(proveedorId),
      fecha,
      concepto: concepto.trim(),
      cantidad_unidades: cantidad === '' ? null : Number(cantidad),
      importe_total: Number(importe),
      nota: nota.trim() || null,
    };
    setBusy(true);
    try {
      if (initial) await api.put(`/compras/${initial.id}`, payload);
      else await api.post('/compras', payload);
      await onSaved();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Proveedor</label>
        <select className="input" value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
          <option value="">Selecciona…</option>
          {proveedores.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Fecha</label>
        <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </div>

      <div>
        <label className="label">Concepto</label>
        <input
          className="input"
          type="text"
          value={concepto}
          onChange={(e) => setConcepto(e.target.value)}
          placeholder="Ej: Lote de gafas de sol"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Unidades (opcional)</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            placeholder="Ej: 100"
          />
        </div>
        <div>
          <label className="label">Importe total (USD)</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={importe}
            onChange={(e) => setImporte(e.target.value)}
            placeholder="0.00"
          />
        </div>
      </div>

      <div>
        <label className="label">Nota (opcional)</label>
        <input
          className="input"
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: factura 123"
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Guardando…' : initial ? 'Guardar cambios' : 'Añadir compra'}
        </button>
      </div>
    </form>
  );
}

/** Formulario para imputar parte de una compra a una unidad. */
function AsignarForm({ compra, clientes = [], onCancel, onSaved }) {
  const pendienteImporte = Math.max(0, compra.importe_total - compra.importe_asignado);
  const pendienteUnidades =
    compra.cantidad_unidades != null
      ? Math.max(0, compra.cantidad_unidades - (compra.unidades_asignadas || 0))
      : null;
  // Coste medio por unidad de la compra (si hay unidades definidas).
  const costeMedio =
    compra.cantidad_unidades && compra.cantidad_unidades > 0
      ? compra.importe_total / compra.cantidad_unidades
      : null;

  const [unidad, setUnidad] = useState('megapolis');
  const [clienteId, setClienteId] = useState('');
  const [unidadesTomadas, setUnidadesTomadas] = useState('');
  const [importe, setImporte] = useState('');
  const [importeTocado, setImporteTocado] = useState(false);
  const [fecha, setFecha] = useState(compra.fecha || todayISO());
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Al escribir unidades, autocalcula el importe (salvo que el usuario lo haya
  // editado manualmente).
  function onUnidadesChange(v) {
    setUnidadesTomadas(v);
    if (!importeTocado && costeMedio != null && v !== '') {
      setImporte((Number(v) * costeMedio).toFixed(2));
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (importe === '' || Number(importe) < 0) return setError('Introduce un importe asignado válido.');
    if (unidad === 'distribucion' && !clienteId) return setError('Elige un cliente de distribución.');

    const payload = {
      unidad,
      cliente_id: unidad === 'distribucion' && clienteId ? Number(clienteId) : null,
      unidades_tomadas: unidadesTomadas === '' ? null : Number(unidadesTomadas),
      importe_asignado: Number(importe),
      fecha,
      nota: nota.trim() || null,
    };
    setBusy(true);
    try {
      await api.post(`/compras/${compra.id}/asignaciones`, payload);
      await onSaved();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Resumen de lo pendiente */}
      <div className="rounded-2xl bg-mulata-50 px-4 py-3 text-sm">
        <p className="text-ink/70">
          <strong>{compra.concepto}</strong> · {money(compra.importe_total)}
        </p>
        <p className="text-ink/50 mt-1">
          Pendiente de asignar: <strong>{money(pendienteImporte)}</strong>
          {pendienteUnidades != null ? ` · ${pendienteUnidades} ud.` : ''}
        </p>
        {costeMedio != null && (
          <p className="text-ink/40 text-xs mt-0.5">Coste medio: {money(costeMedio)} / unidad</p>
        )}
      </div>

      <div>
        <label className="label">Unidad</label>
        <div className="flex gap-2">
          {UNIDADES.map((u) => (
            <button
              type="button"
              key={u.code}
              onClick={() => setUnidad(u.code)}
              className={`chip flex-1 justify-center py-2 text-sm ${
                unidad === u.code ? 'bg-mulata-600 text-white' : 'bg-mulata-50 text-mulata-700'
              }`}
            >
              {u.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cliente de distribución: obligatorio cuando la unidad es distribución */}
      {unidad === 'distribucion' && (
        <div>
          <label className="label">Cliente de distribución</label>
          <select className="input" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
            <option value="">Selecciona…</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {clientes.length === 0 && (
            <p className="text-xs text-amber-600 mt-1">
              No hay clientes de distribución. Crea uno primero en la sección Distribución.
            </p>
          )}
        </div>
      )}

      {compra.cantidad_unidades != null && (
        <div>
          <label className="label">Unidades tomadas (opcional)</label>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={unidadesTomadas}
            onChange={(e) => onUnidadesChange(e.target.value)}
            placeholder={pendienteUnidades != null ? `Quedan ${pendienteUnidades}` : ''}
          />
        </div>
      )}

      <div>
        <label className="label">Importe asignado (USD)</label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-mulata-400 text-lg">$</span>
          <input
            className="input pl-9 text-xl font-semibold"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={importe}
            onChange={(e) => {
              setImporte(e.target.value);
              setImporteTocado(true);
            }}
            placeholder="0.00"
          />
        </div>
        <button
          type="button"
          className="text-xs text-mulata-600 mt-1"
          onClick={() => {
            setImporte(pendienteImporte.toFixed(2));
            setImporteTocado(true);
          }}
        >
          Asignar todo lo pendiente ({money(pendienteImporte)})
        </button>
      </div>

      <div>
        <label className="label">Fecha</label>
        <input className="input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </div>

      <div>
        <label className="label">Nota (opcional)</label>
        <input
          className="input"
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: reparto temporada"
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar asignación'}
        </button>
      </div>
    </form>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pestaña PROVEEDORES
 * ────────────────────────────────────────────────────────────────────────── */
function ProveedoresTab({ proveedores, onChanged }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null);

  return (
    <div className="space-y-4">
      <button
        className="btn-primary w-full"
        onClick={() => {
          setEditing(null);
          setModalOpen(true);
        }}
      >
        ＋ Nuevo proveedor
      </button>

      {proveedores.length === 0 ? (
        <div className="card text-center text-ink/50 py-10">
          <p className="text-3xl mb-2">🚚</p>
          <p>Aún no hay proveedores activos.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {proveedores.map((p) => (
            <li key={p.id} className="card flex items-center justify-between">
              <p className="font-medium truncate">{p.nombre}</p>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditing(p);
                    setModalOpen(true);
                  }}
                  className="h-8 w-8 grid place-items-center rounded-full bg-mulata-50 text-mulata-700 active:scale-90 transition"
                  aria-label="Editar proveedor"
                >
                  ✎
                </button>
                <button
                  onClick={() => setConfirm(p)}
                  className="h-8 w-8 grid place-items-center rounded-full bg-red-50 text-red-500 active:scale-90 transition"
                  aria-label="Desactivar proveedor"
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar proveedor' : 'Nuevo proveedor'}
      >
        <ProveedorForm
          initial={editing}
          onCancel={() => setModalOpen(false)}
          onSaved={async () => {
            setModalOpen(false);
            setEditing(null);
            await onChanged();
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await api.del(`/proveedores/${confirm.id}`);
          await onChanged();
        }}
        title="Desactivar proveedor"
        confirmLabel="Desactivar"
        message={
          confirm
            ? `¿Desactivar el proveedor "${confirm.nombre}"? Sus compras se conservan; solo dejará de aparecer en la lista.`
            : ''
        }
      />
    </div>
  );
}

function ProveedorForm({ initial, onCancel, onSaved }) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!nombre.trim()) return setError('Indica un nombre.');
    setBusy(true);
    try {
      if (initial) await api.put(`/proveedores/${initial.id}`, { nombre: nombre.trim() });
      else await api.post('/proveedores', { nombre: nombre.trim() });
      await onSaved();
    } catch (err) {
      setError(err.message || 'No se pudo guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label">Nombre del proveedor</label>
        <input
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Anisa"
          autoFocus
        />
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      <div className="flex gap-3 pt-1">
        <button type="button" className="btn-ghost flex-1" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? 'Guardando…' : initial ? 'Guardar cambios' : 'Añadir proveedor'}
        </button>
      </div>
    </form>
  );
}
