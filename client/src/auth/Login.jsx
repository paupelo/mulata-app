import { useState } from 'react';
import { useAuth } from './AuthContext';

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-mulata-50 via-cream to-mulata-100 p-6">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 h-20 w-20 rounded-3xl bg-mulata-600 text-white grid place-items-center shadow-soft">
            <span className="font-display text-4xl">M</span>
          </div>
          <h1 className="text-3xl text-mulata-800">Mulata</h1>
          <p className="text-ink/60 mt-1">Gestión de la cuenta de resultados</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Usuario</label>
            <input
              className="input"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu usuario"
              required
            />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs text-ink/40 mt-6">Acceso privado · Mulata Panamá</p>
      </div>
    </div>
  );
}
