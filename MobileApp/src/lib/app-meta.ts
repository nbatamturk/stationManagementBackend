import Constants from 'expo-constants';

import { APP_META } from '@/src/config/app-meta';

type RuntimeExtraAppMeta = {
  displayName?: string;
  displayVersion?: string;
  supportEmail?: string;
};

const getRuntimeExtra = (): RuntimeExtraAppMeta | null => {
  const extra = Constants.expoConfig?.extra;

  if (!extra || typeof extra !== 'object' || !('appMeta' in extra)) {
    return null;
  }

  const appMeta = (extra as { appMeta?: unknown }).appMeta;

  if (!appMeta || typeof appMeta !== 'object') {
    return null;
  }

  return appMeta as RuntimeExtraAppMeta;
};

export const getAppDisplayName = (): string => {
  const runtimeExtra = getRuntimeExtra();
  return runtimeExtra?.displayName ?? Constants.expoConfig?.name ?? APP_META.displayName;
};

export const getAppDisplayVersion = (): string => {
  const runtimeExtra = getRuntimeExtra();
  return runtimeExtra?.displayVersion ?? Constants.expoConfig?.version ?? APP_META.displayVersion;
};

export const getAppVersionLabel = (): string => `Version ${getAppDisplayVersion()}`;

export const getAppSupportEmail = (): string => {
  const runtimeExtra = getRuntimeExtra();
  return runtimeExtra?.supportEmail ?? APP_META.supportEmail;
};
