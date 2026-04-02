import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { colors } from '@/components/theme';

type ErrorStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onActionPress?: () => void;
  secondaryActionLabel?: string;
  onSecondaryActionPress?: () => void;
  compact?: boolean;
};

export const ErrorState = ({
  title,
  description,
  actionLabel,
  onActionPress,
  secondaryActionLabel,
  onSecondaryActionPress,
  compact = false,
}: ErrorStateProps): React.JSX.Element => {
  return (
    <View style={[styles.wrapper, compact && styles.compactWrapper]}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>!</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onActionPress ? (
        <View style={styles.actions}>
          <AppButton label={actionLabel} onPress={onActionPress} />
          {secondaryActionLabel && onSecondaryActionPress ? (
            <AppButton
              label={secondaryActionLabel}
              onPress={onSecondaryActionPress}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderWidth: 1,
    borderColor: '#F0C4C4',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    backgroundColor: '#FFF7F7',
    alignItems: 'center',
  },
  compactWrapper: {
    alignItems: 'flex-start',
  },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#FDE6E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '800',
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
  actions: {
    width: '100%',
    gap: 8,
  },
});
