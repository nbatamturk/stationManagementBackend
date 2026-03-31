'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types/api';
import { authClient } from '@/lib/api/auth-client';
import { clearToken, getToken, setToken } from './token';

const AuthContext = createContext<{ user: User | null; loading: boolean; login: (email: string, password: string) => Promise<void>; logout: () => void }>({ user: null, loading: true, login: async () => undefined, logout: () => undefined });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) return void setLoading(false);
    authClient.me().then((res) => setUser(res.user)).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authClient.login(email, password);
    setToken(res.accessToken);
    setUser(res.user);
  };

  const logout = () => { clearToken(); setUser(null); };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
