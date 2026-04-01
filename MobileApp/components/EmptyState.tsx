import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { colors } from '@/components/theme';

type EmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export const EmptyState = ({
  title,
  description,
  actionLabel,
  onActionPress,
}: EmptyStateProps): React.JSX.Element => {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.icon}>[ ]</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onActionPress ? (
        <AppButton label={actionLabel} onPress={onActionPress} variant="secondary" />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  icon: {
    fontSize: 15,
    color: colors.mutedText,
    fontWeight: '700',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 13,
    color: colors.mutedText,
    lineHeight: 18,
    textAlign: 'center',
  },
});
