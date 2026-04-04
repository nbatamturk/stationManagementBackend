import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppCard,
  AppScreen,
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
  colors,
} from '@/components';
import { useAuth } from '@/features/auth';
import {
  getDashboardSummary,
  getRecentlyUpdatedStations,
} from '@/features/stations';
import type { Station } from '@/types';
import { formatDateTime } from '@/utils/date';

type DashboardSummary = {
  totalStations: number;
  activeStations: number;
  archivedStations: number;
  maintenanceStations: number;
  faultyStations: number;
  totalOpenIssues: number;
  totalCriticalIssues: number;
  recentTestCount: number;
};

export default function DashboardScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [summaryLoading, setSummaryLoading] = useState(isAdmin);
  const [recentLoading, setRecentLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryError, setSummaryError] = useState('');
  const [recentStations, setRecentStations] = useState<Station[]>([]);
  const [recentError, setRecentError] = useState('');

  const loadSummary = useCallback(
    async (showLoadingState = true) => {
      if (!isAdmin) {
        setSummary(null);
        setSummaryError('');
        setSummaryLoading(false);
        return;
      }

      if (showLoadingState) {
        setSummaryLoading(true);
      }

      setSummaryError('');

      try {
        const result = await getDashboardSummary();
        setSummary(result);
      } catch (error) {
        setSummaryError(
          error instanceof Error
            ? `Could not load dashboard summary: ${error.message}`
            : 'Could not load dashboard summary.',
        );
      } finally {
        if (showLoadingState) {
          setSummaryLoading(false);
        }
      }
    },
    [isAdmin],
  );

  const loadRecentStations = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setRecentLoading(true);
    }

    setRecentError('');

    try {
      const result = await getRecentlyUpdatedStations(8);
      setRecentStations(result);
    } catch (error) {
      setRecentError(
        error instanceof Error
          ? `Could not load recent stations: ${error.message}`
          : 'Could not load recent stations.',
      );
    } finally {
      if (showLoadingState) {
        setRecentLoading(false);
      }
    }
  }, []);

  const refreshScreen = useCallback(async () => {
    setRefreshing(true);

    try {
      await Promise.all([loadSummary(false), loadRecentStations(false)]);
    } finally {
      setRefreshing(false);
    }
  }, [loadRecentStations, loadSummary]);

  useFocusEffect(
    useCallback(() => {
      void Promise.all([loadSummary(), loadRecentStations()]);
    }, [loadRecentStations, loadSummary]),
  );

  return (
    <AppScreen refreshing={refreshing} onRefresh={() => void refreshScreen()}>
      {isAdmin ? (
        <AppCard style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Admin Summary</Text>
            {!summaryLoading ? (
              <Text style={styles.cardSubtitle}>Served by backend dashboard endpoints</Text>
            ) : null}
          </View>

          {summaryLoading ? (
            <LoadingState label="Refreshing admin summary..." />
          ) : summaryError ? (
            <ErrorState
              title="Dashboard summary unavailable"
              description={summaryError}
              actionLabel="Retry"
              onActionPress={() => {
                void loadSummary();
              }}
              compact
            />
          ) : summary ? (
            <View style={styles.metricGrid}>
              <MetricBox label="Stations" value={summary.totalStations} />
              <MetricBox label="Active" value={summary.activeStations} />
              <MetricBox label="Maintenance" value={summary.maintenanceStations} />
              <MetricBox label="Faulty" value={summary.faultyStations} />
              <MetricBox label="Open Issues" value={summary.totalOpenIssues} />
              <MetricBox label="Critical" value={summary.totalCriticalIssues} />
              <MetricBox label="Recent Tests" value={summary.recentTestCount} />
              <MetricBox label="Archived" value={summary.archivedStations} />
            </View>
          ) : null}
        </AppCard>
      ) : null}

      <AppCard>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Recently Updated Stations</Text>
          <Text style={styles.cardSubtitle}>Most recent backend changes</Text>
        </View>

        {recentLoading ? (
          <LoadingState label="Loading recent stations..." />
        ) : recentError ? (
          <ErrorState
            title="Recent stations unavailable"
            description={recentError}
            actionLabel="Retry"
            onActionPress={() => {
              void loadRecentStations();
            }}
            compact
          />
        ) : recentStations.length === 0 ? (
          <EmptyState
            title="No recent station updates"
            description="Stations will appear here as soon as the backend returns updated records."
            actionLabel="Open Station List"
            onActionPress={() => router.push('/stations')}
          />
        ) : (
          recentStations.map((station) => (
            <Pressable
              key={station.id}
              onPress={() => router.push({ pathname: '/stations/[id]', params: { id: station.id } })}
              style={({ pressed }) => [styles.stationRow, pressed && styles.pressed]}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.stationName}>{station.name}</Text>
                <Text style={styles.stationMeta}>
                  {station.code} • {station.location}
                </Text>
                <Text style={styles.stationMeta}>
                  {station.brand} {station.model} • {station.powerKw} kW • Updated {formatDateTime(station.updatedAt)}
                </Text>
              </View>
              <StatusBadge status={station.status} isArchived={station.isArchived} />
            </Pressable>
          ))
        )}
      </AppCard>
    </AppScreen>
  );
}

const MetricBox = ({ label, value }: { label: string; value: number }): React.JSX.Element => {
  return (
    <View style={styles.metricBox}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  summaryCard: {
    gap: 12,
  },
  cardHeader: {
    gap: 2,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.mutedText,
    lineHeight: 18,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    width: '31%',
    minWidth: 96,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: '#FBFCFF',
    alignItems: 'center',
    gap: 3,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.mutedText,
  },
  stationRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowLeft: {
    flex: 1,
    gap: 4,
  },
  stationName: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
  },
  stationMeta: {
    fontSize: 12,
    color: colors.mutedText,
  },
  pressed: {
    opacity: 0.82,
  },
});
