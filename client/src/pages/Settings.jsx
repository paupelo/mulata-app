import { useRef, useState } from 'react';
import { getToken } from '../api';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import ConfirmDialog from '../components/ConfirmDialog';

export default function Settings() {
  const { user, logout } = useAuth();
  const [msg, setMsg] = useState(null);
  const [importConfirm, setImportConfirm] = useState(null);
  const fileRef = useRef(null);

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

  return (
    <div className="space-y-5 max-w-xl">
      <div>
        <h1 className="text-2xl text-mulata-800">⚙️ Ajustes</h1>
        <p className="text-ink/50 text-sm">Copias de seguridad y sesión</p>
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
