import { type Href, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard, AppScreen, colors } from '@/components';
import { useAuth } from '@/features/auth';

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const isAdmin = user?.role === 'admin';
  const changePasswordRoute = '/settings/change-password' as Href;

  const handleConfirmSignOut = async (): Promise<void> => {
    if (signingOut) {
      return;
    }

    setSigningOut(true);

    try {
      await signOut();
      router.replace('/login');
    } finally {
      setSigningOut(false);
    }
  };

  const handleSignOutPress = (): void => {
    if (signingOut) {
      return;
    }

    Alert.alert('Sign Out', 'Are you sure you want to sign out of this device?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          void handleConfirmSignOut();
        },
      },
    ]);
  };

  return (
    <AppScreen>
      <AppCard>
        <View style={styles.sessionHeader}>
          <View style={styles.sessionBody}>
            <Text style={styles.sessionTitle}>{user?.fullName ?? 'Signed In User'}</Text>
            <Text style={styles.sessionMeta}>{user?.email ?? '-'}</Text>
            <Text style={styles.sessionMeta}>Role: {user?.role ?? '-'}</Text>
          </View>
          <AppButton
            label={signingOut ? 'Signing Out...' : 'Sign Out'}
            variant="secondary"
            onPress={handleSignOutPress}
            disabled={signingOut}
          />
        </View>
      </AppCard>

      <Pressable
        style={({ pressed }) => [styles.item, pressed && styles.pressed]}
        onPress={() => router.push(changePasswordRoute)}
      >
        <AppCard>
          <Text style={styles.itemTitle}>Change Password</Text>
          <Text style={styles.itemDescription}>
            Update your account password while keeping this device signed in.
          </Text>
        </AppCard>
      </Pressable>

      {isAdmin ? (
        <Pressable
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          onPress={() => router.push('/settings/custom-fields')}
        >
          <AppCard>
            <Text style={styles.itemTitle}>Custom Field Management</Text>
            <Text style={styles.itemDescription}>
              Manage backend-driven dynamic fields used in mobile station forms and filters.
            </Text>
          </AppCard>
        </Pressable>
      ) : null}

      <AppCard>
        <Text style={styles.itemTitle}>Pilot Limitations</Text>
        <View style={styles.noteGroup}>
          <Text style={styles.noteText}>Offline sync is not enabled in this mobile build yet.</Text>
          <Text style={styles.noteText}>Background sync and attachment upload flows are intentionally disabled.</Text>
          <Text style={styles.noteText}>Backend records remain the source of truth for all field actions.</Text>
        </View>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  item: {
    borderRadius: 12,
  },
  pressed: {
    opacity: 0.82,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  itemDescription: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
  },
  sessionHeader: {
    gap: 12,
  },
  sessionBody: {
    gap: 4,
  },
  sessionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  sessionMeta: {
    fontSize: 13,
    color: colors.mutedText,
  },
  noteGroup: {
    gap: 8,
  },
  noteText: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
  },
});
