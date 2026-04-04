import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppMetaFooter } from '@/components/AppMetaFooter';
import { colors, spacing } from '@/components/theme';

type AppScreenProps = {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardAvoiding?: boolean;
  showAppMetaFooter?: boolean;
};

export const AppScreen = ({
  children,
  scroll = true,
  contentContainerStyle,
  refreshing = false,
  onRefresh,
  keyboardAvoiding = false,
  showAppMetaFooter = true,
}: AppScreenProps): React.JSX.Element => {
  const insets = useSafeAreaInsets();
  const bottomPadding = 24 + Math.max(insets.bottom, spacing.lg);
  const behavior = Platform.OS === 'ios' ? 'padding' : 'height';

  const screenContent = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
    >
      <View style={[styles.body, contentContainerStyle]}>{children}</View>
      {showAppMetaFooter ? <AppMetaFooter style={styles.footer} /> : null}
    </ScrollView>
  ) : (
    <View style={[styles.content, { paddingBottom: bottomPadding }]}>
      <View style={[styles.body, contentContainerStyle]}>{children}</View>
      {showAppMetaFooter ? <AppMetaFooter style={styles.footer} /> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView behavior={behavior} style={styles.flex}>
          {screenContent}
        </KeyboardAvoidingView>
      ) : (
        screenContent
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: spacing.xs,
    backgroundColor: colors.background,
  },
  body: {
    flexGrow: 1,
    gap: spacing.md,
  },
  footer: {
    marginTop: spacing.lg,
  },
});
