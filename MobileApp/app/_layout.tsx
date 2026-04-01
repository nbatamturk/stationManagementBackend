import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { AppScreen, LoadingState } from '@/components';
import { AuthProvider, useAuth } from '@/features/auth';

export { ErrorBoundary } from 'expo-router';

const stackScreenOptions = {
  headerTitleStyle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
};

const RootNavigator = (): React.JSX.Element => {
  const { status, isAuthenticated } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (status === 'loading') {
      return;
    }

    const isOnLoginScreen = segments[0] === 'login';

    if (!isAuthenticated && !isOnLoginScreen) {
      router.replace('/login');
      return;
    }

    if (isAuthenticated && isOnLoginScreen) {
      router.replace('/');
    }
  }, [isAuthenticated, router, segments, status]);

  if (status === 'loading') {
    return (
      <AppScreen>
        <LoadingState label="Restoring session..." />
      </AppScreen>
    );
  }

  return (
    <Stack screenOptions={stackScreenOptions}>
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="stations/[id]" options={{ title: 'Station Detail' }} />
      <Stack.Screen name="stations/edit" options={{ title: 'Station Create / Edit' }} />
      <Stack.Screen name="settings/custom-fields" options={{ title: 'Custom Fields' }} />
    </Stack>
  );
};

export default function RootLayout(): React.JSX.Element {
  return (
    <>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </>
  );
}
