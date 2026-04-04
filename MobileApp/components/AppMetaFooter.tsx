import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/components/theme';
import { getAppVersionLabel } from '@/src/lib/app-meta';

type AppMetaFooterProps = {
  style?: StyleProp<ViewStyle>;
};

export const AppMetaFooter = ({ style }: AppMetaFooterProps): React.JSX.Element => {
  return (
    <View style={[styles.wrapper, style]}>
      <Text style={styles.versionText}>{getAppVersionLabel()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
  },
  versionText: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
