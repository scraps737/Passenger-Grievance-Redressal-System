import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../lib/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const [engine, setEngine] = useState(null);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return null;
    }
    try {
      const { user: me } = await api.me();
      setUser(me);
      return me;
    } catch {
      tokenStore.clear();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onUnauthorized = () => setUser(null);
    window.addEventListener('grievanceai:unauthorized', onUnauthorized);
    api
      .aiEngine()
      .then((res) => setEngine(res.engine))
      .catch(() => setEngine(null));
    return () => window.removeEventListener('grievanceai:unauthorized', onUnauthorized);
  }, [refresh]);

  const login = useCallback(async (email, password) => {
    const res = await api.login({ email, password });
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await api.register(payload);
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const updateUser = useCallback((next) => setUser(next), []);

  const value = useMemo(
    () => ({
      user,
      loading,
      engine,
      login,
      register,
      logout,
      refresh,
      updateUser,
      isAuthenticated: Boolean(user),
      role: user?.role || null,
      isPassenger: user?.role === 'passenger',
      isOfficer: user?.role === 'officer',
      isAdmin: user?.role === 'admin',
    }),
    [user, loading, engine, login, register, logout, refresh, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export const HOME_FOR_ROLE = {
  passenger: '/passenger',
  officer: '/officer',
  admin: '/admin',
};
