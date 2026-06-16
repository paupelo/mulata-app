import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  // Al cargar, valida el token guardado contra /auth/me.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((data) => setUser(data.username))
      .catch(() => logout())
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/auth/login', { username, password });
    setToken(data.token);
    setUser(data.username);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
