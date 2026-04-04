import type { ConfigContext, ExpoConfig } from 'expo/config';

import { APP_META } from './src/config/app-meta.ts';

const getEnvOverride = (key: string, fallback: string): string => {
  const value = process.env[key]?.trim();
  return value ? value : fallback;
};

const resolvedAppMeta = {
  displayName: getEnvOverride('EXPO_PUBLIC_APP_DISPLAY_NAME', APP_META.displayName),
  displayVersion: getEnvOverride('EXPO_PUBLIC_APP_DISPLAY_VERSION', APP_META.displayVersion),
  supportEmail: getEnvOverride('EXPO_PUBLIC_SUPPORT_EMAIL', APP_META.supportEmail),
};

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: resolvedAppMeta.displayName,
  slug: APP_META.slug,
  version: resolvedAppMeta.displayVersion,
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: APP_META.scheme,
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: APP_META.branding.splashBackground,
  },
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'com.nbatamturk.stationmanagement',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: APP_META.branding.splashBackground,
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: ['android.permission.CAMERA', 'android.permission.RECORD_AUDIO'],
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-camera',
      {
        cameraPermission: 'Allow this app to scan charging station QR codes.',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    appMeta: {
      displayName: resolvedAppMeta.displayName,
      displayVersion: resolvedAppMeta.displayVersion,
      supportEmail: resolvedAppMeta.supportEmail,
    },
    eas: {
      projectId: '93048f7e-d07e-462f-8338-2e419ec260b1',
    },
  },
});
