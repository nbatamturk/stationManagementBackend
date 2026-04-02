import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { registerUnauthorizedHandler, setAccessToken } from '@/lib/auth/session-store';
import {
  clearStoredSession,
  readStoredAuthUser,
  readStoredAccessToken,
  writeStoredAccessToken,
  writeStoredAuthUser,
} from '@/lib/auth/token-storage';
import { getApiErrorMessage, isUnauthorizedError } from '@/lib/api/errors';

import { getCurrentUser, login } from './service';
import type { AuthState, AuthUser } from './types';

type AuthContextValue = AuthState & {
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<AuthUser | null>;
  retrySessionRestore: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }): React.JSX.Element => {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    user: null,
    sessionErrorMessage: null,
  });

  const clearSession = useCallback(async () => {
    setAccessToken(null);
    await clearStoredSession();
    setState({
      status: 'unauthenticated',
      user: null,
      sessionErrorMessage: null,
    });
  }, []);

  const setAuthenticatedState = useCallback(async (user: AuthUser) => {
    await writeStoredAuthUser(user);
    setState({
      status: 'authenticated',
      user,
      sessionErrorMessage: null,
    });
  }, []);

  const refreshUser = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const user = await getCurrentUser();
      await setAuthenticatedState(user);
      return user;
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await clearSession();
      } else {
        setState((prev) => ({
          ...prev,
          status: prev.user ? 'authenticated' : prev.status,
          sessionErrorMessage: getApiErrorMessage(
            error,
            'The session could not be refreshed. Try again when the connection is stable.',
          ),
        }));
      }

      throw error;
    }
  }, [clearSession, setAuthenticatedState]);

  const restoreSession = useCallback(async () => {
    const [token, cachedUser] = await Promise.all([
      readStoredAccessToken(),
      readStoredAuthUser(),
    ]);

    if (!token) {
      setState({
        status: 'unauthenticated',
        user: null,
        sessionErrorMessage: null,
      });
      return;
    }

    setAccessToken(token);

    if (cachedUser) {
      setState({
        status: 'loading',
        user: cachedUser,
        sessionErrorMessage: null,
      });
    }

    try {
      const user = await getCurrentUser();
      await setAuthenticatedState(user);
    } catch (error) {
      if (isUnauthorizedError(error)) {
        await clearSession();
        return;
      }

      setState({
        status: 'retry-required',
        user: cachedUser,
        sessionErrorMessage: getApiErrorMessage(
          error,
          'The saved session could not be verified. Retry when the network is available.',
        ),
      });
    }
  }, [clearSession, setAuthenticatedState]);

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
    await Promise.all([
      writeStoredAccessToken(response.accessToken),
      writeStoredAuthUser(response.user),
    ]);
    setState({
      status: 'authenticated',
      user: response.user,
      sessionErrorMessage: null,
    });
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const retrySessionRestore = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: 'loading',
      sessionErrorMessage: null,
    }));
    await restoreSession();
  }, [restoreSession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: state.status === 'authenticated' && state.user !== null,
      signIn,
      signOut,
      refreshUser,
      retrySessionRestore,
    }),
    [refreshUser, retrySessionRestore, signIn, signOut, state],
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
