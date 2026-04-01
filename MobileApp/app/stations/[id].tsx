import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppScreen,
  AppTextInput,
  EmptyState,
  LoadingState,
  OptionChip,
  StatusBadge,
  colors,
} from '@/components';
import { useAuth } from '@/features/auth';
import { getCustomFieldDefinitions } from '@/features/custom-fields';
import { addStationIssueRecord, getStationIssueRecords } from '@/features/issues';
import { archiveStation, deleteStation, getStationById } from '@/features/stations';
import type { StationDetails } from '@/features/stations';
import { addStationTestHistory, getStationTestHistory } from '@/features/test-history';
import type {
  CustomFieldDefinition,
  IssueSeverity,
  StationIssueRecord,
  StationTestHistoryRecord,
  TestResult,
} from '@/types';
import { formatDateShort, formatDateTime } from '@/utils/date';
import { STATION_STATUS_LABELS, getStationDisplayStatus } from '@/utils/station';

const testResultOptions: Array<{ label: string; value: TestResult }> = [
  { label: 'Pass', value: 'pass' },
  { label: 'Warning', value: 'warning' },
  { label: 'Fail', value: 'fail' },
];

const issueSeverityOptions: Array<{ label: string; value: IssueSeverity }> = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
];

const TEST_RESULT_LABELS: Record<TestResult, string> = {
  pass: 'Pass',
  warning: 'Warning',
  fail: 'Fail',
};

const TEST_RESULT_COLORS: Record<TestResult, string> = {
  pass: '#0F9D58',
  warning: '#F9A825',
  fail: '#D93025',
};

const ISSUE_SEVERITY_COLORS: Record<IssueSeverity, string> = {
  low: '#0F9D58',
  medium: '#1E88E5',
  high: '#FB8C00',
  critical: '#D93025',
};

const ISSUE_STATUS_LABELS: Record<StationIssueRecord['status'], string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const FieldRow = ({ label, value }: { label: string; value?: string | number | null }): React.JSX.Element => {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value ?? '-'}</Text>
    </View>
  );
};

const InfoPill = ({ label, color }: { label: string; color: string }): React.JSX.Element => {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
};

export default function StationDetailScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();

  const stationId = typeof params.id === 'string' ? params.id : '';

  const [loading, setLoading] = useState(true);
  const [savingTest, setSavingTest] = useState(false);
  const [savingIssue, setSavingIssue] = useState(false);
  const [processingLifecycleAction, setProcessingLifecycleAction] = useState(false);

  const [station, setStation] = useState<StationDetails | null>(null);
  const [customDefinitions, setCustomDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [testHistory, setTestHistory] = useState<StationTestHistoryRecord[]>([]);
  const [issueRecords, setIssueRecords] = useState<StationIssueRecord[]>([]);

  const [testForm, setTestForm] = useState({
    testType: '',
    result: 'pass' as TestResult,
    notes: '',
  });
  const [issueForm, setIssueForm] = useState({
    title: '',
    severity: 'medium' as IssueSeverity,
    description: '',
  });

  const [testFormError, setTestFormError] = useState('');
  const [issueFormError, setIssueFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [loadError, setLoadError] = useState('');

  const canWriteRecords = user?.role === 'admin' || user?.role === 'operator';
  const canManageLifecycle = user?.role === 'admin';

  const refreshSecondPhaseSections = useCallback(async () => {
    if (!stationId) {
      return;
    }

    const [historyResult, issueResult] = await Promise.all([
      getStationTestHistory(stationId),
      getStationIssueRecords(stationId),
    ]);

    setTestHistory(historyResult);
    setIssueRecords(issueResult);
  }, [stationId]);

  const loadStation = useCallback(async () => {
    if (!stationId) {
      setStation(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const [stationResult, definitionResult, historyResult, issueResult] = await Promise.all([
        getStationById(stationId),
        getCustomFieldDefinitions(false),
        getStationTestHistory(stationId),
        getStationIssueRecords(stationId),
      ]);

      setStation(stationResult);
      setCustomDefinitions(definitionResult);
      setTestHistory(historyResult);
      setIssueRecords(issueResult);
    } catch (error) {
      setStation(null);
      setCustomDefinitions([]);
      setTestHistory([]);
      setIssueRecords([]);
      setLoadError(
        error instanceof Error
          ? `Could not load station detail: ${error.message}`
          : 'Could not load station detail.',
      );
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useFocusEffect(
    useCallback(() => {
      void loadStation();
    }, [loadStation]),
  );

  const customFieldRows = useMemo(() => {
    if (!station) {
      return [];
    }

    const knownIds = new Set(customDefinitions.map((definition) => definition.id));

    const rows = customDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      value: station.customValuesByFieldId[definition.id] ?? '-',
    }));

    for (const [fieldId, value] of Object.entries(station.customValuesByFieldId)) {
      if (!knownIds.has(fieldId)) {
        rows.push({
          id: fieldId,
          label: `Archived Field (${fieldId})`,
          value,
        });
      }
    }

    return rows;
  }, [customDefinitions, station]);

  const submitTestRecord = async (): Promise<void> => {
    if (!station) {
      return;
    }

    if (!canWriteRecords) {
      setTestFormError('Your role does not allow creating test history records.');
      return;
    }

    setTestFormError('');

    const normalizedType = testForm.testType.trim();
    if (!normalizedType) {
      setTestFormError('Test type is required.');
      return;
    }

    if (normalizedType.length < 3) {
      setTestFormError('Test type must be at least 3 characters.');
      return;
    }

    setSavingTest(true);

    try {
      await addStationTestHistory({
        stationId: station.id,
        testType: normalizedType,
        result: testForm.result,
        notes: testForm.notes.trim() || undefined,
      });

      await refreshSecondPhaseSections();

      setTestForm({
        testType: '',
        result: 'pass',
        notes: '',
      });
    } catch (error) {
      setTestFormError(
        error instanceof Error
          ? `Could not save test record: ${error.message}`
          : 'Could not save test record. Please try again.',
      );
    } finally {
      setSavingTest(false);
    }
  };

  const submitIssueRecord = async (): Promise<void> => {
    if (!station) {
      return;
    }

    if (!canWriteRecords) {
      setIssueFormError('Your role does not allow creating issue records.');
      return;
    }

    setIssueFormError('');

    const normalizedTitle = issueForm.title.trim();
    if (!normalizedTitle) {
      setIssueFormError('Issue title is required.');
      return;
    }

    if (normalizedTitle.length < 3) {
      setIssueFormError('Issue title must be at least 3 characters.');
      return;
    }

    setSavingIssue(true);

    try {
      await addStationIssueRecord({
        stationId: station.id,
        title: normalizedTitle,
        severity: issueForm.severity,
        description: issueForm.description.trim() || undefined,
      });

      await refreshSecondPhaseSections();

      setIssueForm({
        title: '',
        severity: 'medium',
        description: '',
      });
    } catch (error) {
      setIssueFormError(
        error instanceof Error
          ? `Could not save issue record: ${error.message}`
          : 'Could not save issue record. Please try again.',
      );
    } finally {
      setSavingIssue(false);
    }
  };

  const runArchive = async (): Promise<void> => {
    if (!station) {
      return;
    }

    setActionError('');
    setProcessingLifecycleAction(true);

    try {
      await archiveStation(station.id);
      router.replace('/stations');
    } catch (error) {
      setActionError(
        error instanceof Error
          ? `Could not archive station: ${error.message}`
          : 'Could not archive station. Please try again.',
      );
    } finally {
      setProcessingLifecycleAction(false);
    }
  };

  const runDelete = async (): Promise<void> => {
    if (!station) {
      return;
    }

    setActionError('');
    setProcessingLifecycleAction(true);

    try {
      await deleteStation(station.id);
      router.replace('/stations');
    } catch (error) {
      setActionError(
        error instanceof Error
          ? `Could not delete station: ${error.message}`
          : 'Could not delete station. Please try again.',
      );
    } finally {
      setProcessingLifecycleAction(false);
    }
  };

  const confirmArchive = (): void => {
    if (!station || station.isArchived) {
      return;
    }

    Alert.alert(
      'Archive Station',
      `Archive "${station.name}"? The station will remain in backend records as archived.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'default',
          onPress: () => {
            void runArchive();
          },
        },
      ],
    );
  };

  const confirmDelete = (): void => {
    if (!station) {
      return;
    }

    Alert.alert(
      'Delete Station',
      `Delete "${station.name}" permanently? This will also remove local test history, issues, and custom values linked to this station.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void runDelete();
          },
        },
      ],
    );
  };

  return (
    <AppScreen>
      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

      {loading ? (
        <LoadingState label="Loading station details..." />
      ) : !station ? (
        <EmptyState
          title="Station not found"
          description={loadError || 'The selected station record could not be loaded.'}
          actionLabel="Go To Station List"
          onActionPress={() => router.replace('/stations')}
        />
      ) : (
        <>
          <AppCard>
            <View style={styles.headerRow}>
              <View style={styles.headerMain}>
                <Text style={styles.stationName}>{station.name}</Text>
                <Text style={styles.stationMeta}>
                  {station.code} • {station.brand} • {station.model}
                </Text>
              </View>
              <StatusBadge status={station.status} isArchived={station.isArchived} />
            </View>

            <FieldRow label="Station ID" value={station.id} />
            <FieldRow label="Name" value={station.name} />
            <FieldRow label="Code" value={station.code} />
            <FieldRow
              label="Status"
              value={STATION_STATUS_LABELS[getStationDisplayStatus(station.status, station.isArchived)]}
            />
            <FieldRow label="QR Code" value={station.qrCode} />
            <FieldRow label="Brand" value={station.brand} />
            <FieldRow label="Model" value={station.model} />
            <FieldRow label="Serial Number" value={station.serialNumber} />
            <FieldRow label="Power" value={`${station.powerKw} kW`} />
            <FieldRow label="Current Type" value={station.currentType} />
            <FieldRow label="Socket Type" value={station.socketType} />
            <FieldRow label="Location" value={station.location} />
            <FieldRow label="Last Test Date" value={formatDateShort(station.lastTestDate)} />
            <FieldRow label="Archived At" value={formatDateTime(station.archivedAt)} />
            <FieldRow label="Notes" value={station.notes} />
            <FieldRow label="Created At" value={formatDateTime(station.createdAt)} />
            <FieldRow label="Updated At" value={formatDateTime(station.updatedAt)} />
          </AppCard>

          <AppCard>
            <Text style={styles.cardTitle}>Custom Properties</Text>
            {customFieldRows.length === 0 ? (
              <Text style={styles.emptyText}>No custom field values are available for this station.</Text>
            ) : (
              customFieldRows.map((item) => <FieldRow key={item.id} label={item.label} value={item.value} />)
            )}
          </AppCard>

          <AppCard>
            <Text style={styles.cardTitle}>Test History</Text>

            {testHistory.length === 0 ? (
              <Text style={styles.emptyText}>No test records added yet.</Text>
            ) : (
              testHistory.map((record) => (
                <View key={record.id} style={styles.recordItem}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordTitle}>{record.testType}</Text>
                    <InfoPill
                      label={TEST_RESULT_LABELS[record.result]}
                      color={TEST_RESULT_COLORS[record.result]}
                    />
                  </View>
                  <Text style={styles.recordMeta}>Performed: {formatDateTime(record.performedAt)}</Text>
                  {record.performedBy ? (
                    <Text style={styles.recordMeta}>Performed By: {record.performedBy}</Text>
                  ) : null}
                  {record.notes ? <Text style={styles.recordBody}>{record.notes}</Text> : null}
                </View>
              ))
            )}

            <View style={styles.sectionDivider} />
            <Text style={styles.formTitle}>Add Test Record</Text>
            {!canWriteRecords ? (
              <Text style={styles.helperText}>
                Your current role can view test history but cannot create new records.
              </Text>
            ) : null}

            <AppTextInput
              label="Test Type"
              required
              value={testForm.testType}
              onChangeText={(value) => setTestForm((prev) => ({ ...prev, testType: value }))}
              placeholder="Example: Functional Verification"
            />

            <View style={styles.formGroup}>
              <Text style={styles.filterLabel}>Result</Text>
              <View style={styles.inlineRow}>
                {testResultOptions.map((option) => (
                  <OptionChip
                    key={option.value}
                    label={option.label}
                    selected={testForm.result === option.value}
                    onPress={() => setTestForm((prev) => ({ ...prev, result: option.value }))}
                  />
                ))}
              </View>
            </View>

            <AppTextInput
              label="Notes"
              value={testForm.notes}
              onChangeText={(value) => setTestForm((prev) => ({ ...prev, notes: value }))}
              placeholder="Optional details"
              multiline
            />

            {testFormError ? <Text style={styles.errorText}>{testFormError}</Text> : null}

            <AppButton
              label={savingTest ? 'Saving Test Record...' : 'Add Test Record'}
              onPress={() => {
                void submitTestRecord();
              }}
              disabled={savingTest || !canWriteRecords}
            />
          </AppCard>

          <AppCard>
            <Text style={styles.cardTitle}>Issue / Fault Records</Text>

            {issueRecords.length === 0 ? (
              <Text style={styles.emptyText}>No issue records added yet.</Text>
            ) : (
              issueRecords.map((record) => (
                <View key={record.id} style={styles.recordItem}>
                  <View style={styles.recordHeader}>
                    <Text style={styles.recordTitle}>{record.title}</Text>
                    <View style={styles.badgeRow}>
                      <InfoPill
                        label={record.severity.toUpperCase()}
                        color={ISSUE_SEVERITY_COLORS[record.severity]}
                      />
                      <InfoPill label={ISSUE_STATUS_LABELS[record.status]} color={colors.primary} />
                    </View>
                  </View>
                  <Text style={styles.recordMeta}>Reported: {formatDateTime(record.reportedAt)}</Text>
                  {record.description ? <Text style={styles.recordBody}>{record.description}</Text> : null}
                </View>
              ))
            )}

            <View style={styles.sectionDivider} />
            <Text style={styles.formTitle}>Add Issue Record</Text>
            {!canWriteRecords ? (
              <Text style={styles.helperText}>
                Your current role can view issues but cannot create new records.
              </Text>
            ) : null}

            <AppTextInput
              label="Issue Title"
              required
              value={issueForm.title}
              onChangeText={(value) => setIssueForm((prev) => ({ ...prev, title: value }))}
              placeholder="Example: Connector latch fault"
            />

            <View style={styles.formGroup}>
              <Text style={styles.filterLabel}>Severity</Text>
              <View style={styles.inlineRow}>
                {issueSeverityOptions.map((option) => (
                  <OptionChip
                    key={option.value}
                    label={option.label}
                    selected={issueForm.severity === option.value}
                    onPress={() => setIssueForm((prev) => ({ ...prev, severity: option.value }))}
                  />
                ))}
              </View>
            </View>

            <AppTextInput
              label="Description"
              value={issueForm.description}
              onChangeText={(value) => setIssueForm((prev) => ({ ...prev, description: value }))}
              placeholder="Optional details"
              multiline
            />

            {issueFormError ? <Text style={styles.errorText}>{issueFormError}</Text> : null}

            <AppButton
              label={savingIssue ? 'Saving Issue Record...' : 'Add Issue Record'}
              onPress={() => {
                void submitIssueRecord();
              }}
              disabled={savingIssue || !canWriteRecords}
            />
          </AppCard>

          {actionError ? <Text style={styles.errorText}>{actionError}</Text> : null}
          {canManageLifecycle ? (
            <View style={styles.actionRow}>
              <AppButton
                label={station.isArchived ? 'Already Archived' : 'Archive Station'}
                onPress={confirmArchive}
                variant="secondary"
                disabled={processingLifecycleAction || station.isArchived}
                style={styles.actionButton}
              />
              <AppButton
                label={processingLifecycleAction ? 'Processing...' : 'Delete Station'}
                onPress={confirmDelete}
                variant="danger"
                disabled={processingLifecycleAction}
                style={styles.actionButton}
              />
            </View>
          ) : (
            <Text style={styles.helperText}>
              Archive and delete actions are restricted to admin users in backend phase 1.
            </Text>
          )}
        </>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 2,
  },
  headerMain: {
    flex: 1,
    gap: 4,
  },
  stationName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  stationMeta: {
    fontSize: 13,
    color: colors.mutedText,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  fieldRow: {
    gap: 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 8,
  },
  fieldLabel: {
    fontSize: 12,
    color: colors.mutedText,
    fontWeight: '600',
  },
  fieldValue: {
    fontSize: 14,
    color: colors.text,
  },
  emptyText: {
    color: colors.mutedText,
    fontSize: 13,
  },
  recordItem: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    gap: 4,
    backgroundColor: colors.surface,
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    alignItems: 'flex-start',
  },
  recordTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  recordMeta: {
    color: colors.mutedText,
    fontSize: 12,
  },
  recordBody: {
    color: colors.text,
    fontSize: 13,
  },
  pill: {
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginVertical: 4,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  formGroup: {
    gap: 8,
  },
  filterLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
});
