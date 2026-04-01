import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { registerUnauthorizedHandler, setAccessToken } from '@/lib/auth/session-store';
import {
  clearStoredAccessToken,
  readStoredAccessToken,
  writeStoredAccessToken,
} from '@/lib/auth/token-storage';

import { getCurrentUser, login } from './service';
import type { AuthState, AuthUser } from './types';

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
  });

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    await clearStoredAccessToken();
    setState({
      status: 'unauthenticated',
      user: null,
    });
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const user = await getCurrentUser();
      setState({
        status: 'authenticated',
        user,
      });
      return user;
    } catch (error) {
      await clearSession();
      throw error;
    }
  }, [clearSession]);

  const restoreSession = useCallback(async () => {
    const token = await readStoredAccessToken();

    if (!token) {
      setState({
        status: 'unauthenticated',
        user: null,
      });
      return;
    }

    setAccessToken(token);

    try {
      const user = await getCurrentUser();
      setState({
        status: 'authenticated',
        user,
      });
    } catch {
      await clearSession();
    }
  }, [clearSession]);

  useEffect(() => {
    registerUnauthorizedHandler(() => clearSession());
    void restoreSession();

    return () => {
      registerUnauthorizedHandler(null);
    };
  }, [clearSession, restoreSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await login(email, password);
    setAccessToken(response.accessToken);
    await writeStoredAccessToken(response.accessToken);
    setState({
      status: 'authenticated',
      user: response.user,
    });
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: state.status === 'authenticated' && state.user !== null,
      signIn,
      signOut,
      refreshUser,
    }),
    [refreshUser, signIn, signOut, state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};
