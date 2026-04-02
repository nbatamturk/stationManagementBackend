import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { AppButton, AppCard, AppScreen, ErrorState, LoadingState } from '@/components';
import { AuthProvider, useAuth } from '@/features/auth';

export { ErrorBoundary } from 'expo-router';

const stackScreenOptions = {
  headerTitleStyle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
};

const RootNavigator = (): React.JSX.Element => {
  const { status, isAuthenticated, retrySessionRestore, signOut, sessionErrorMessage, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (status === 'loading' || status === 'retry-required') {
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

  if (status === 'retry-required') {
    return (
      <AppScreen contentContainerStyle={{ justifyContent: 'center' }}>
        <AppCard style={{ gap: 14 }}>
          <ErrorState
            title={user ? `Reconnect ${user.fullName.split(' ')[0]}'s session` : 'Reconnect session'}
            description={
              sessionErrorMessage ??
              'The saved session could not be verified right now. Retry instead of signing in again.'
            }
            actionLabel="Retry Session"
            onActionPress={() => {
              void retrySessionRestore();
            }}
            compact
          />
          <AppButton
            label="Sign Out"
            variant="secondary"
            onPress={() => {
              void signOut();
            }}
          />
        </AppCard>
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
