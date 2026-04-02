import * as SecureStore from 'expo-secure-store';

import type { AuthUser } from '@/features/auth/types';

const ACCESS_TOKEN_KEY = 'station_mobile_access_token';
const AUTH_USER_KEY = 'station_mobile_auth_user';

export const readStoredAccessToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
};

export const writeStoredAccessToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
};

export const clearStoredAccessToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
};

export const readStoredAuthUser = async (): Promise<AuthUser | null> => {
  const rawValue = await SecureStore.getItemAsync(AUTH_USER_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as AuthUser;
  } catch {
    await SecureStore.deleteItemAsync(AUTH_USER_KEY);
    return null;
  }
};

export const writeStoredAuthUser = async (user: AuthUser): Promise<void> => {
  await SecureStore.setItemAsync(AUTH_USER_KEY, JSON.stringify(user));
};

export const clearStoredAuthUser = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(AUTH_USER_KEY);
};

export const clearStoredSession = async (): Promise<void> => {
  await Promise.all([clearStoredAccessToken(), clearStoredAuthUser()]);
};
