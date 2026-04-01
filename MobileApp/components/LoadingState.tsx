import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/components/theme';

type LoadingStateProps = {
  label?: string;
  compact?: boolean;
};

export const LoadingState = ({
  label = 'Loading...',
  compact = false,
}: LoadingStateProps): React.JSX.Element => {
  return (
    <View style={[styles.wrapper, compact && styles.compactWrapper]}>
      <ActivityIndicator size="small" color={colors.primary} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 24,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: '#FBFCFF',
  },
  compactWrapper: {
    paddingVertical: 10,
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 13,
    color: colors.mutedText,
  },
});
