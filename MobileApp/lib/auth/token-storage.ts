import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'station_mobile_access_token';

export const readStoredAccessToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
};

export const writeStoredAccessToken = async (token: string): Promise<void> => {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
};

export const clearStoredAccessToken = async (): Promise<void> => {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
};
