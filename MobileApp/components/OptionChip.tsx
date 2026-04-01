import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius } from '@/components/theme';

type OptionChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export const OptionChip = ({ label, selected, onPress }: OptionChipProps): React.JSX.Element => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected ? styles.selectedText : styles.unselectedText]}>
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  selected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  unselected: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  pressed: {
    opacity: 0.8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  selectedText: {
    color: colors.primary,
  },
  unselectedText: {
    color: colors.text,
  },
});
