import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors } from '@/components/theme';

type LabeledSwitchProps = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

export const LabeledSwitch = ({ label, value, onValueChange }: LabeledSwitchProps): React.JSX.Element => {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: '#77A9FF' }} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
