import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { apiFetch } from '@/lib/api/http';
import type { MobileAppVersionCheckResult } from '@/types';

type SuccessResponse<T> = {
  data: T;
};

export const getInstalledAppVersion = (): string | null => {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return null;
  }

  const nativeApplicationVersion = Application.nativeApplicationVersion?.trim() || null;
  const configuredApplicationVersion = Constants.expoConfig?.version?.trim() || null;

  // In Expo Go and debug sessions, nativeApplicationVersion can reflect the host binary
  // rather than this project's configured app version, which makes warning checks misleading.
  if (__DEV__ || Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return configuredApplicationVersion ?? nativeApplicationVersion;
  }

  return nativeApplicationVersion ?? configuredApplicationVersion;
};

export const getMobilePlatform = (): 'ios' | 'android' | null => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    return Platform.OS;
  }

  return null;
};

export const checkMobileAppVersion = async (): Promise<MobileAppVersionCheckResult | null> => {
  const platform = getMobilePlatform();
  const appVersion = getInstalledAppVersion();

  if (!platform || !appVersion) {
    return null;
  }

  const response = await apiFetch<SuccessResponse<MobileAppVersionCheckResult>>(
    '/mobile-app-config/check',
    {
      method: 'POST',
      body: JSON.stringify({
        platform,
        appVersion,
      }),
      auth: false,
    },
  );

  return response.data;
};
