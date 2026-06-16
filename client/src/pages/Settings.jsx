import { useRef, useState } from 'react';
import { getToken } from '../api';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

const SHEET_LABELS = {
  VENTAS_TIENDA: 'Ventas de tienda',
  VENTAS_DISTRIBUCION: 'Ventas de distribución',
  GASTOS_TIENDA: 'Gastos de tienda',
  GASTOS_GENERALES: 'Gastos generales',
};

export default function Settings() {
  const { user, logout } = useAuth();
  const [msg, setMsg] = useState(null);
  const [importConfirm, setImportConfirm] = useState(null);
  const fileRef = useRef(null);

  // Estado del importador de Excel.
  const xlsxRef = useRef(null);
  const [xlsxFile, setXlsxFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [excelResult, setExcelResult] = useState(null);

  // Descarga un export protegido por JWT (fetch + blob, no enlace directo).
  async function download(format) {
    setMsg(null);
    try {
      const res = await fetch(`/api/data/export/${format}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('No se pudo exportar.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `mulata-backup-${stamp}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ type: 'ok', text: `Backup ${format.toUpperCase()} descargado.` });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  function pickFile() {
    fileRef.current?.click();
  }

  async function onFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      setImportConfirm(json);
    } catch {
      setMsg({ type: 'error', text: 'El archivo no es un JSON válido.' });
    }
  }

  async function doImport(json) {
    setMsg(null);
    try {
      await api.post('/data/import', { data: json.data || json, mode: 'replace' });
      setMsg({ type: 'ok', text: 'Datos restaurados correctamente. Recarga la app para verlos.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  // ----------------------- Importación desde Excel -----------------------

  function pickXlsx() {
    xlsxRef.current?.click();
  }

  function onXlsxChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    setExcelResult(null);
    setMsg(null);
    if (!file) return;
    setXlsxFile(file);
  }

  async function doExcelImport() {
    if (!xlsxFile) return;
    setMsg(null);
    setExcelResult(null);
    setImporting(true);
    try {
      const form = new FormData();
      form.append('file', xlsxFile);
      const res = await fetch('/api/import/excel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No se pudo importar el archivo.');
      setExcelResult(data);
      setXlsxFile(null);
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    } finally {
      setImporting(false);
    }
  }

  async function downloadTemplate() {
    setMsg(null);
    try {
      const res = await fetch('/api/import/template', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('No se pudo generar la plantilla.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'plantilla-mulata.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg({ type: 'ok', text: 'Plantilla descargada.' });
    } catch (err) {
      setMsg({ type: 'error', text: err.message });
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="text-2xl text-mulata-800">⚙️ Ajustes</h1>
        <p className="text-ink/50 text-sm">Importación, copias de seguridad y sesión</p>
      </div>

      {msg && (
        <p
          className={`rounded-2xl px-4 py-3 text-sm ${
            msg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* ---------------------- Importar desde Excel ---------------------- */}
      <div className="card space-y-3">
        <h2 className="text-lg text-mulata-800">📥 Importar datos desde Excel</h2>
        <p className="text-sm text-ink/60">
          Sube un archivo <strong>.xlsx</strong> con las hojas <em>VENTAS_TIENDA</em>,{' '}
          <em>VENTAS_DISTRIBUCION</em>, <em>GASTOS_TIENDA</em> y <em>GASTOS_GENERALES</em>. Puedes
          reimportar el mismo archivo sin miedo: los registros repetidos se omiten automáticamente.
        </p>

        <button className="btn-ghost w-full" onClick={pickXlsx} disabled={importing}>
          📄 {xlsxFile ? `Archivo: ${xlsxFile.name}` : 'Seleccionar archivo .xlsx'}
        </button>
        <input
          ref={xlsxRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={onXlsxChosen}
        />

        <button
          className="btn-primary w-full"
          onClick={doExcelImport}
          disabled={!xlsxFile || importing}
        >
          {importing ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Importando…
            </span>
          ) : (
            'Importar'
          )}
        </button>

        <button className="btn-ghost w-full" onClick={downloadTemplate} disabled={importing}>
          ⬇️ Descargar plantilla vacía
        </button>

        {excelResult && <ImportResult result={excelResult} />}
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg text-mulata-800">Copia de seguridad</h2>
        <p className="text-sm text-ink/60">
          Descarga todos tus datos cuando quieras. Guarda el archivo en un lugar seguro.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="btn-primary flex-1" onClick={() => download('json')}>
            ⬇️ Exportar JSON
          </button>
          <button className="btn-ghost flex-1" onClick={() => download('csv')}>
            ⬇️ Exportar CSV
          </button>
        </div>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg text-mulata-800">Restaurar datos</h2>
        <p className="text-sm text-ink/60">
          Importa un backup JSON. <strong>Atención:</strong> reemplaza todos los datos actuales.
        </p>
        <button className="btn-ghost w-full" onClick={pickFile}>
          ⬆️ Importar desde JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFileChosen} />
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg text-mulata-800">Sesión</h2>
        <p className="text-sm text-ink/60">Conectada como <strong>{user}</strong>.</p>
        <button className="btn-danger w-full" onClick={logout}>
          Cerrar sesión
        </button>
      </div>

      <p className="text-center text-xs text-ink/40">Mulata · {new Date().getFullYear()}</p>

      <ConfirmDialog
        open={!!importConfirm}
        onClose={() => setImportConfirm(null)}
        onConfirm={() => doImport(importConfirm)}
        title="Restaurar copia de seguridad"
        message="Esto reemplazará TODOS los datos actuales por los del archivo. ¿Continuar?"
        confirmLabel="Restaurar"
      />
    </div>
  );
}

/** Pantalla de resultado de la importación de Excel, amable y desglosada. */
function ImportResult({ result }) {
  const { summary = {}, totals = {}, errors = [] } = result || {};
  const sheets = Object.keys(SHEET_LABELS).filter((k) => summary[k]);

  return (
    <div className="mt-2 space-y-3 rounded-2xl bg-mulata-50 p-4">
      <div>
        <h3 className="text-base text-mulata-800">✅ Importación completada</h3>
        <p className="text-sm text-ink/70">
          <strong className="text-green-700">{totals.inserted || 0}</strong> registros nuevos ·{' '}
          <strong className="text-amber-600">{totals.skipped || 0}</strong> omitidos (duplicados) ·{' '}
          <strong className={totals.errors ? 'text-red-600' : 'text-ink/50'}>
            {totals.errors || 0}
          </strong>{' '}
          con error
        </p>
      </div>

      <div className="space-y-2">
        {sheets.map((k) => {
          const s = summary[k];
          return (
            <div key={k} className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-sm">
              <span className="text-ink/80">
                {SHEET_LABELS[k]}
                {!s.present && <span className="text-ink/40"> · no incluida</span>}
              </span>
              <span className="flex gap-3 tabular-nums">
                <span className="text-green-700">+{s.inserted}</span>
                <span className="text-amber-600">↺{s.skipped}</span>
                <span className={s.errors ? 'text-red-600' : 'text-ink/30'}>⚠{s.errors}</span>
              </span>
            </div>
          );
        })}
      </div>

      {errors.length > 0 && (
        <details className="rounded-xl bg-white px-3 py-2 text-sm">
          <summary className="cursor-pointer text-red-600">
            Ver {errors.length} {errors.length === 1 ? 'error' : 'errores'}
          </summary>
          <ul className="mt-2 space-y-1 text-ink/70">
            {errors.map((e, i) => (
              <li key={i}>
                <span className="text-ink/50">
                  {SHEET_LABELS[e.sheet] || e.sheet} · fila {e.row}:
                </span>{' '}
                {e.reason}
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-ink/50">Recarga la app si no ves los nuevos datos reflejados.</p>
    </div>
  );
}
