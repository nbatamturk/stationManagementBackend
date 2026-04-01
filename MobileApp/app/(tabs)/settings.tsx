import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard, AppScreen, colors } from '@/components';
import { useAuth } from '@/features/auth';
import { settingsMenuItems } from '@/features/settings/menu';

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const { signOut, user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const isAdmin = user?.role === 'admin';
  const visibleMenuItems = settingsMenuItems.map((item) =>
    item.label === 'Custom Field Management' && !isAdmin
      ? {
          ...item,
          route: undefined,
          isComingSoon: true,
          description: 'Read/write custom field management remains admin-only in backend phase 1.',
        }
      : item,
  );

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

      {visibleMenuItems.map((item) => (
        <Pressable
          key={item.label}
          style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          onPress={() => {
            if (item.route) {
              router.push(item.route as never);
            }
          }}
          disabled={!item.route}
        >
          <AppCard>
            <View style={styles.itemHeader}>
              <Text style={styles.itemTitle}>{item.label}</Text>
              {item.isComingSoon ? <Text style={styles.comingSoon}>Coming Soon</Text> : null}
            </View>
            <Text style={styles.itemDescription}>{item.description}</Text>
          </AppCard>
        </Pressable>
      ))}
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'center',
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
  comingSoon: {
    fontSize: 11,
    color: colors.mutedText,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
    fontWeight: '600',
  },
});
