import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  STATION_STATUS_COLORS,
  STATION_STATUS_LABELS,
  getStationDisplayStatus,
} from '@/utils/station';
import type { StationStatus } from '@/types';

type StatusBadgeProps = {
  status: StationStatus;
  isArchived?: boolean;
};

export const StatusBadge = ({
  status,
  isArchived = false,
}: StatusBadgeProps): React.JSX.Element => {
  const displayStatus = getStationDisplayStatus(status, isArchived);

  return (
    <View style={[styles.badge, { backgroundColor: `${STATION_STATUS_COLORS[displayStatus]}1A` }]}>
      <View style={[styles.dot, { backgroundColor: STATION_STATUS_COLORS[displayStatus] }]} />
      <Text style={[styles.label, { color: STATION_STATUS_COLORS[displayStatus] }]}>
        {STATION_STATUS_LABELS[displayStatus]}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
