import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton, AppCard, AppScreen, colors } from '@/components';

export default function AddEditStationScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ stationId?: string; qrCode?: string }>();

  const stationId = typeof params.stationId === 'string' ? params.stationId : '';
  const qrCode = typeof params.qrCode === 'string' ? params.qrCode : '';

  return (
    <AppScreen contentContainerStyle={styles.content}>
      <AppCard style={styles.card}>
        <Text style={styles.title}>Station Create / Edit Deferred</Text>
        <Text style={styles.body}>
          Phase 1 integration connects authentication, station read flows, QR lookup, test history,
          and issue records to backend. Station create/update is intentionally held for the next
          phase so the app does not write to the old local SQLite prototype by mistake.
        </Text>

        {stationId ? (
          <Text style={styles.meta}>Requested station id: {stationId}</Text>
        ) : null}
        {qrCode ? <Text style={styles.meta}>Scanned QR value: {qrCode}</Text> : null}

        <View style={styles.actions}>
          {stationId ? (
            <AppButton
              label="Back To Station Detail"
              onPress={() => router.replace({ pathname: '/stations/[id]', params: { id: stationId } })}
            />
          ) : null}
          <AppButton
            label="Open Station List"
            variant={stationId ? 'secondary' : 'primary'}
            onPress={() => router.replace('/stations')}
          />
        </View>
      </AppCard>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'center',
  },
  card: {
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedText,
  },
  meta: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  actions: {
    gap: 10,
  },
});
