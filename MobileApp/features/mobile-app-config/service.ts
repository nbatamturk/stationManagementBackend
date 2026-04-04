import * as Application from 'expo-application';
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

  return Application.nativeApplicationVersion?.trim() || null;
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
