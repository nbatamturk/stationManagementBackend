import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/components/theme';

const TabIcon = ({
  name,
  color,
}: {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
}): React.JSX.Element => <Ionicons name={name} size={20} color={color} />;

export default function TabLayout(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const bottomInset =
    Platform.OS === 'android'
      ? insets.bottom > 0
        ? insets.bottom
        : 20
      : Math.max(insets.bottom, 8);
  const tabBarHeight = 56 + bottomInset;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#7D879A',
        tabBarStyle: {
          borderTopColor: '#E1E7EE',
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: bottomInset,
          paddingTop: 6,
          backgroundColor: '#FFFFFF',
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        tabBarHideOnKeyboard: true,
        headerTitleStyle: {
          fontSize: 16,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <TabIcon name="home-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="stations"
        options={{
          title: 'Stations',
          tabBarIcon: ({ color }) => <TabIcon name="list-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'QR Scan',
          tabBarIcon: ({ color }) => <TabIcon name="qr-code-outline" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabIcon name="settings-outline" color={color} />,
        }}
      />
    </Tabs>
  );
}
