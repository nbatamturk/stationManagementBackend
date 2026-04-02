'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { Role, User } from '@/types/api';
import { authClient } from '@/lib/api/auth-client';
import { clearToken, getToken, setToken } from './token';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  role: Role | null;
  isAdmin: boolean;
  canWrite: boolean;
  hasRole: (roles: Role[]) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const defaultValue: AuthContextValue = {
  user: null,
  loading: true,
  role: null,
  isAdmin: false,
  canWrite: false,
  hasRole: () => false,
  login: async () => undefined,
  logout: () => undefined,
};

const AuthContext = createContext<AuthContextValue>(defaultValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return void setLoading(false);
    authClient.me().then((res) => setUser(res.user)).catch(() => {
      clearToken();
      setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authClient.login(email, password);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = () => { clearToken(); setUser(null); };

  const role = user?.role ?? null;
  const hasRole = (roles: Role[]) => role !== null && roles.includes(role);
  const value: AuthContextValue = {
    user,
    loading,
    role,
    isAdmin: role === 'admin',
    canWrite: role === 'admin' || role === 'operator',
    hasRole,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
