import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard, AppScreen, ErrorState, LoadingState, colors } from '@/components';
import { AuthProvider, useAuth } from '@/features/auth';
import { checkMobileAppVersion } from '@/features/mobile-app-config/service';
import type { MobileAppVersionCheckResult } from '@/types';

export { ErrorBoundary } from 'expo-router';

const stackScreenOptions = {
  headerTitleStyle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
};

type VersionWarningState = {
  result: MobileAppVersionCheckResult;
  signature: string;
};

const getWarningSignature = (result: MobileAppVersionCheckResult) =>
  `${result.platform}:${result.appVersion}:${result.minimumSupportedVersion ?? 'none'}`;

const buildWarningMessage = (result: MobileAppVersionCheckResult) =>
  result.message ??
  `Installed ${result.platform.toUpperCase()} app version ${result.appVersion} is below the configured minimum supported version ${result.minimumSupportedVersion}.`;

const RootNavigator = (): React.JSX.Element => {
  const { status, isAuthenticated, retrySessionRestore, signOut, sessionErrorMessage, user } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const dismissedWarningSignaturesRef = useRef(new Set<string>());
  const latestAuthWarningCheckKeyRef = useRef('');
  const [versionWarning, setVersionWarning] = useState<VersionWarningState | null>(null);

  const runVersionCheck = useCallback(async () => {
    try {
      const result = await checkMobileAppVersion();

      if (!result || !result.shouldWarn) {
        return;
      }

      const signature = getWarningSignature(result);

      if (dismissedWarningSignaturesRef.current.has(signature)) {
        return;
      }

      setVersionWarning((current) => {
        if (current?.signature === signature) {
          return current;
        }

        return {
          result,
          signature,
        };
      });
    } catch {
      // Version policy checks are intentionally non-blocking.
    }
  }, []);

  useEffect(() => {
    void runVersionCheck();
  }, [runVersionCheck]);

  useEffect(() => {
    if (status !== 'authenticated' || !user) {
      if (status !== 'authenticated') {
        latestAuthWarningCheckKeyRef.current = '';
      }

      return;
    }

    const nextKey = `${user.id}:${user.role}`;

    if (latestAuthWarningCheckKeyRef.current === nextKey) {
      return;
    }

    latestAuthWarningCheckKeyRef.current = nextKey;
    void runVersionCheck();
  }, [runVersionCheck, status, user]);

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
        <VersionWarningModal
          warning={versionWarning}
          onDismiss={() => {
            if (!versionWarning) {
              return;
            }

            dismissedWarningSignaturesRef.current.add(versionWarning.signature);
            setVersionWarning(null);
          }}
        />
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
        <VersionWarningModal
          warning={versionWarning}
          onDismiss={() => {
            if (!versionWarning) {
              return;
            }

            dismissedWarningSignaturesRef.current.add(versionWarning.signature);
            setVersionWarning(null);
          }}
        />
      </AppScreen>
    );
  }

  return (
    <>
      <Stack screenOptions={stackScreenOptions}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="stations/[id]" options={{ title: 'Station Detail' }} />
        <Stack.Screen name="stations/edit" options={{ title: 'Station Create / Edit' }} />
        <Stack.Screen name="settings/change-password" options={{ title: 'Change Password' }} />
        <Stack.Screen name="settings/custom-fields" options={{ title: 'Admin-Web Only' }} />
      </Stack>
      <VersionWarningModal
        warning={versionWarning}
        onDismiss={() => {
          if (!versionWarning) {
            return;
          }

          dismissedWarningSignaturesRef.current.add(versionWarning.signature);
          setVersionWarning(null);
        }}
      />
    </>
  );
};

const VersionWarningModal = ({
  warning,
  onDismiss,
}: {
  warning: VersionWarningState | null;
  onDismiss: () => void;
}): React.JSX.Element | null => {
  if (!warning) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <AppCard style={styles.warningCard}>
          <Text style={styles.warningEyebrow}>Version Notice</Text>
          <Text style={styles.warningTitle}>App update recommended</Text>
          <Text style={styles.warningBody}>{buildWarningMessage(warning.result)}</Text>

          <View style={styles.warningMeta}>
            <Text style={styles.warningMetaText}>Platform: {warning.result.platform.toUpperCase()}</Text>
            <Text style={styles.warningMetaText}>Installed: {warning.result.appVersion}</Text>
            <Text style={styles.warningMetaText}>
              Minimum supported: {warning.result.minimumSupportedVersion ?? 'Not configured'}
            </Text>
          </View>

          <AppButton label="Continue" onPress={onDismiss} />
        </AppCard>
      </View>
    </Modal>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.52)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  warningCard: {
    gap: 14,
    borderColor: '#D6E4FF',
  },
  warningEyebrow: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  warningTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  warningBody: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 22,
  },
  warningMeta: {
    gap: 4,
    borderRadius: 12,
    backgroundColor: '#F4F8FF',
    borderWidth: 1,
    borderColor: '#D6E4FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  warningMetaText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
});
