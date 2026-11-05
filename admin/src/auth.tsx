import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { api, NotAdminError, TOKEN_KEY, type Me } from './api';

interface AuthValue {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);


export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(() => !!localStorage.getItem(TOKEN_KEY));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setMe(null);
  }, []);

  // Restore the session on page load.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api
      .get<Me>('/me')
      .then(({ data }) => (data.role === 'admin' ? setMe(data) : logout()))
      .catch(logout)
      .finally(() => setLoading(false));
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const { data } = await api.post<{ access_token: string }>('/auth/login', { email, password });
    localStorage.setItem(TOKEN_KEY, data.access_token);
    const { data: user } = await api.get<Me>('/me');
    if (user.role !== 'admin') {
      localStorage.removeItem(TOKEN_KEY);
      throw new NotAdminError();
    }
    setMe(user);
  }, []);

  return <AuthContext.Provider value={{ me, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
