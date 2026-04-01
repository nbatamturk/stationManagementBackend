import React from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing } from '@/components/theme';

type AppScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

export const AppScreen = ({
  children,
  scroll = true,
  contentContainerStyle,
}: AppScreenProps): React.JSX.Element => {
  const insets = useSafeAreaInsets();
  const bottomPadding = 24 + Math.max(insets.bottom, spacing.lg);

  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <View style={[styles.content, { paddingBottom: bottomPadding }, contentContainerStyle]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: spacing.xs,
    backgroundColor: colors.background,
    gap: spacing.md,
  },
});
