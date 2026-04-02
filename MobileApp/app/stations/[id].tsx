import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppScreen,
  AppTextInput,
  EmptyState,
  ErrorState,
  LoadingState,
  OptionChip,
  StatusBadge,
  colors,
} from '@/components';
import { useAuth } from '@/features/auth';
import { getCustomFieldDefinitions } from '@/features/custom-fields';
import { addStationIssueRecord, getStationIssueRecords } from '@/features/issues';
import {
  archiveStation,
  deleteStation,
  getStationById,
} from '@/features/stations';
import { addStationTestHistory, getStationTestHistory } from '@/features/test-history';
import type {
  CustomFieldDefinition,
  IssueSeverity,
  Station,
  StationIssueRecord,
  StationTestHistoryRecord,
  TestResult,
} from '@/types';
import { formatDateShort, formatDateTime } from '@/utils/date';
import { STATION_STATUS_LABELS, getStationDisplayStatus } from '@/utils/station';

const sectionOptions = [
  { label: 'Overview', value: 'overview' },
  { label: 'Tests', value: 'tests' },
  { label: 'Issues', value: 'issues' },
] as const;

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

const FieldRow = ({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}): React.JSX.Element => {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value ?? '-'}</Text>
    </View>
  );
};

const InfoPill = ({
  label,
  color,
}: {
  label: string;
  color: string;
}): React.JSX.Element => {
  return (
    <View style={[styles.pill, { backgroundColor: `${color}1A` }]}>
      <Text style={[styles.pillText, { color }]}>{label}</Text>
    </View>
  );
};

const formatCustomFieldValue = (
  definition: CustomFieldDefinition | undefined,
  value: unknown,
): string => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  if (definition?.type === 'date' && typeof value === 'string') {
    return formatDateShort(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (typeof value === 'number' || typeof value === 'string') {
    return String(value);
  }

  return JSON.stringify(value);
};

export default function StationDetailScreen(): React.JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ id?: string }>();

  const stationId = typeof params.id === 'string' ? params.id : '';
  const [activeSection, setActiveSection] =
    useState<(typeof sectionOptions)[number]['value']>('overview');

  const [station, setStation] = useState<Station | null>(null);
  const [stationLoading, setStationLoading] = useState(true);
  const [stationError, setStationError] = useState('');

  const [customDefinitions, setCustomDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [customFieldsLoading, setCustomFieldsLoading] = useState(true);
  const [customFieldsError, setCustomFieldsError] = useState('');

  const [testHistory, setTestHistory] = useState<StationTestHistoryRecord[]>([]);
  const [testsLoading, setTestsLoading] = useState(true);
  const [testsError, setTestsError] = useState('');
  const [savingTest, setSavingTest] = useState(false);
  const [showTestComposer, setShowTestComposer] = useState(false);
  const [testForm, setTestForm] = useState({
    testType: '',
    result: 'pass' as TestResult,
    notes: '',
  });
  const [testFormError, setTestFormError] = useState('');

  const [issueRecords, setIssueRecords] = useState<StationIssueRecord[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(true);
  const [issuesError, setIssuesError] = useState('');
  const [savingIssue, setSavingIssue] = useState(false);
  const [showIssueComposer, setShowIssueComposer] = useState(false);
  const [issueForm, setIssueForm] = useState({
    title: '',
    severity: 'medium' as IssueSeverity,
    description: '',
  });
  const [issueFormError, setIssueFormError] = useState('');

  const [processingLifecycleAction, setProcessingLifecycleAction] = useState(false);
  const [actionError, setActionError] = useState('');

  const canWriteRecords = user?.role === 'admin' || user?.role === 'operator';
  const canManageLifecycle = user?.role === 'admin';

  const loadStation = useCallback(
    async (showLoadingState = true) => {
      if (!stationId) {
        setStation(null);
        setStationLoading(false);
        return;
      }

      if (showLoadingState) {
        setStationLoading(true);
      }

      setStationError('');

      try {
        const result = await getStationById(stationId);
        setStation(result);
      } catch (error) {
        setStationError(
          error instanceof Error
            ? `Could not load station detail: ${error.message}`
            : 'Could not load station detail.',
        );

        if (showLoadingState) {
          setStation(null);
        }
      } finally {
        if (showLoadingState) {
          setStationLoading(false);
        }
      }
    },
    [stationId],
  );

  const loadCustomFields = useCallback(async (showLoadingState = true) => {
    if (showLoadingState) {
      setCustomFieldsLoading(true);
    }

    setCustomFieldsError('');

    try {
      const result = await getCustomFieldDefinitions(false);
      setCustomDefinitions(result);
    } catch (error) {
      setCustomDefinitions([]);
      setCustomFieldsError(
        error instanceof Error
          ? `Could not load custom fields: ${error.message}`
          : 'Could not load custom fields.',
      );
    } finally {
      if (showLoadingState) {
        setCustomFieldsLoading(false);
      }
    }
  }, []);

  const loadTests = useCallback(
    async (showLoadingState = true) => {
      if (!stationId) {
        setTestsLoading(false);
        return;
      }

      if (showLoadingState) {
        setTestsLoading(true);
      }

      setTestsError('');

      try {
        const result = await getStationTestHistory(stationId);
        setTestHistory(result);
      } catch (error) {
        setTestsError(
          error instanceof Error
            ? `Could not load test history: ${error.message}`
            : 'Could not load test history.',
        );
      } finally {
        if (showLoadingState) {
          setTestsLoading(false);
        }
      }
    },
    [stationId],
  );

  const loadIssues = useCallback(
    async (showLoadingState = true) => {
      if (!stationId) {
        setIssuesLoading(false);
        return;
      }

      if (showLoadingState) {
        setIssuesLoading(true);
      }

      setIssuesError('');

      try {
        const result = await getStationIssueRecords(stationId);
        setIssueRecords(result);
      } catch (error) {
        setIssuesError(
          error instanceof Error
            ? `Could not load issue records: ${error.message}`
            : 'Could not load issue records.',
        );
      } finally {
        if (showLoadingState) {
          setIssuesLoading(false);
        }
      }
    },
    [stationId],
  );

  useFocusEffect(
    useCallback(() => {
      void Promise.all([loadStation(), loadCustomFields(), loadTests(), loadIssues()]);
    }, [loadCustomFields, loadIssues, loadStation, loadTests]),
  );

  const customFieldRows = useMemo(() => {
    if (!station) {
      return [];
    }

    const rows = customDefinitions.map((definition) => ({
      id: definition.id,
      label: definition.label,
      value: formatCustomFieldValue(definition, station.customFields?.[definition.key]),
    }));

    const knownKeys = new Set(customDefinitions.map((definition) => definition.key));

    for (const [key, value] of Object.entries(station.customFields ?? {})) {
      if (knownKeys.has(key)) {
        continue;
      }

      rows.push({
        id: key,
        label: `Archived Field (${key})`,
        value: formatCustomFieldValue(undefined, value),
      });
    }

    return rows.filter((item) => item.value !== '-');
  }, [customDefinitions, station]);

  const submitTestRecord = async (): Promise<void> => {
    if (!station || savingTest) {
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

      setTestForm({
        testType: '',
        result: 'pass',
        notes: '',
      });
      setShowTestComposer(false);
      await Promise.all([loadTests(false), loadStation(false)]);
    } catch (error) {
      setTestFormError(
        error instanceof Error
          ? `Could not save test record: ${error.message}`
          : 'Could not save test record.',
      );
    } finally {
      setSavingTest(false);
    }
  };

  const submitIssueRecord = async (): Promise<void> => {
    if (!station || savingIssue) {
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

      setIssueForm({
        title: '',
        severity: 'medium',
        description: '',
      });
      setShowIssueComposer(false);
      await Promise.all([loadIssues(false), loadStation(false)]);
    } catch (error) {
      setIssueFormError(
        error instanceof Error
          ? `Could not save issue record: ${error.message}`
          : 'Could not save issue record.',
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
          : 'Could not archive station.',
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
          : 'Could not delete station.',
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
      `Archive "${station.name}"? The record will stay in backend history as archived.`,
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
      `Delete "${station.name}" permanently from backend records?`,
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

  if (stationLoading) {
    return (
      <AppScreen>
        <LoadingState label="Loading station details..." />
      </AppScreen>
    );
  }

  if (!station) {
    return (
      <AppScreen>
        {stationError ? (
          <ErrorState
            title="Station detail unavailable"
            description={stationError}
            actionLabel="Retry"
            onActionPress={() => {
              void Promise.all([loadStation(), loadCustomFields(), loadTests(), loadIssues()]);
            }}
          />
        ) : (
          <EmptyState
            title="Station not found"
            description="The selected station record could not be loaded."
            actionLabel="Open Station List"
            onActionPress={() => router.replace('/stations')}
          />
        )}
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppCard>
        <View style={styles.headerRow}>
          <View style={styles.headerMain}>
            <Text style={styles.stationName}>{station.name}</Text>
            <Text style={styles.stationMeta}>
              {station.code} • {station.brand} • {station.model}
            </Text>
            <Text style={styles.stationMeta}>{station.location}</Text>
          </View>
          <StatusBadge status={station.status} isArchived={station.isArchived} />
        </View>

        <View style={styles.summaryRow}>
          <InfoPill label={`${station.summary?.openIssueCount ?? 0} Open Issues`} color={colors.primary} />
          <InfoPill
            label={`${station.summary?.testHistoryCount ?? 0} Tests`}
            color="#0F9D58"
          />
          {station.summary?.latestTestResult ? (
            <InfoPill
              label={`Latest: ${TEST_RESULT_LABELS[station.summary.latestTestResult]}`}
              color={TEST_RESULT_COLORS[station.summary.latestTestResult]}
            />
          ) : null}
        </View>

        <View style={styles.sectionSelector}>
          {sectionOptions.map((option) => (
            <OptionChip
              key={option.value}
              label={option.label}
              selected={activeSection === option.value}
              onPress={() => setActiveSection(option.value)}
            />
          ))}
        </View>
      </AppCard>

      {activeSection === 'overview' ? (
        <>
          {stationError ? (
            <ErrorState
              title="Station overview needs refresh"
              description={stationError}
              actionLabel="Retry Overview"
              onActionPress={() => {
                void Promise.all([loadStation(), loadCustomFields(false)]);
              }}
              compact
            />
          ) : null}

          <AppCard>
            <Text style={styles.cardTitle}>Overview</Text>
            <FieldRow label="Station ID" value={station.id} />
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

            {canWriteRecords ? (
              <>
                <View style={styles.sectionDivider} />
                <AppButton
                  label={station.isArchived ? 'Archived Station' : 'Edit Station'}
                  onPress={() =>
                    router.push({ pathname: '/stations/edit', params: { stationId: station.id } })
                  }
                  variant="secondary"
                  disabled={station.isArchived}
                />
                {station.isArchived ? (
                  <Text style={styles.helperText}>
                    Archived stations are read-only and cannot be edited from mobile.
                  </Text>
                ) : null}
              </>
            ) : null}
          </AppCard>

          <AppCard>
            <Text style={styles.cardTitle}>Custom Fields</Text>
            {customFieldsLoading ? (
              <LoadingState label="Loading custom fields..." compact />
            ) : customFieldsError ? (
              <ErrorState
                title="Custom fields unavailable"
                description={customFieldsError}
                actionLabel="Retry"
                onActionPress={() => {
                  void loadCustomFields();
                }}
                compact
              />
            ) : customFieldRows.length === 0 ? (
              <Text style={styles.emptyText}>No custom field values are available for this station.</Text>
            ) : (
              customFieldRows.map((item) => (
                <FieldRow key={item.id} label={item.label} value={item.value} />
              ))
            )}
          </AppCard>

          {actionError ? (
            <ErrorState
              title="Station action failed"
              description={actionError}
              actionLabel="Retry Overview"
              onActionPress={() => {
                void loadStation(false);
              }}
              compact
            />
          ) : null}

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
              Archive and delete actions are restricted to admin users.
            </Text>
          )}
        </>
      ) : null}

      {activeSection === 'tests' ? (
        <AppCard>
          <Text style={styles.cardTitle}>Test History</Text>

          {testsLoading ? (
            <LoadingState label="Loading test history..." />
          ) : testsError ? (
            <ErrorState
              title="Test history unavailable"
              description={testsError}
              actionLabel="Retry"
              onActionPress={() => {
                void loadTests();
              }}
              compact
            />
          ) : testHistory.length === 0 ? (
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
          <View style={styles.formHeaderRow}>
            <View style={styles.formHeaderText}>
              <Text style={styles.formTitle}>Add Test Record</Text>
              <Text style={styles.helperText}>
                {canWriteRecords
                  ? 'Create a new backend test record when work is complete.'
                  : 'Your current role can view test history but cannot create new records.'}
              </Text>
            </View>
            {canWriteRecords ? (
              <AppButton
                label={showTestComposer ? 'Hide Form' : 'New Test'}
                variant="secondary"
                onPress={() => setShowTestComposer((prev) => !prev)}
              />
            ) : null}
          </View>

          {showTestComposer && canWriteRecords ? (
            <View style={styles.composer}>
              <AppTextInput
                label="Test Type"
                required
                value={testForm.testType}
                onChangeText={(value) => {
                  setTestForm((prev) => ({ ...prev, testType: value }));
                  setTestFormError('');
                }}
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
                onChangeText={(value) => {
                  setTestForm((prev) => ({ ...prev, notes: value }));
                  setTestFormError('');
                }}
                placeholder="Optional details"
                multiline
              />

              {testFormError ? <Text style={styles.errorText}>{testFormError}</Text> : null}

              <AppButton
                label={savingTest ? 'Saving Test Record...' : 'Save Test Record'}
                onPress={() => {
                  void submitTestRecord();
                }}
                disabled={savingTest}
              />
            </View>
          ) : null}
        </AppCard>
      ) : null}

      {activeSection === 'issues' ? (
        <AppCard>
          <Text style={styles.cardTitle}>Issue Records</Text>

          {issuesLoading ? (
            <LoadingState label="Loading issue records..." />
          ) : issuesError ? (
            <ErrorState
              title="Issue records unavailable"
              description={issuesError}
              actionLabel="Retry"
              onActionPress={() => {
                void loadIssues();
              }}
              compact
            />
          ) : issueRecords.length === 0 ? (
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
          <View style={styles.formHeaderRow}>
            <View style={styles.formHeaderText}>
              <Text style={styles.formTitle}>Add Issue Record</Text>
              <Text style={styles.helperText}>
                {canWriteRecords
                  ? 'Log a backend issue record for faults or field observations.'
                  : 'Your current role can view issues but cannot create new records.'}
              </Text>
            </View>
            {canWriteRecords ? (
              <AppButton
                label={showIssueComposer ? 'Hide Form' : 'New Issue'}
                variant="secondary"
                onPress={() => setShowIssueComposer((prev) => !prev)}
              />
            ) : null}
          </View>

          {showIssueComposer && canWriteRecords ? (
            <View style={styles.composer}>
              <AppTextInput
                label="Issue Title"
                required
                value={issueForm.title}
                onChangeText={(value) => {
                  setIssueForm((prev) => ({ ...prev, title: value }));
                  setIssueFormError('');
                }}
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
                onChangeText={(value) => {
                  setIssueForm((prev) => ({ ...prev, description: value }));
                  setIssueFormError('');
                }}
                placeholder="Optional details"
                multiline
              />

              {issueFormError ? <Text style={styles.errorText}>{issueFormError}</Text> : null}

              <AppButton
                label={savingIssue ? 'Saving Issue Record...' : 'Save Issue Record'}
                onPress={() => {
                  void submitIssueRecord();
                }}
                disabled={savingIssue}
              />
            </View>
          ) : null}
        </AppCard>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
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
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sectionSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  formHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-start',
  },
  formHeaderText: {
    flex: 1,
    gap: 4,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  composer: {
    gap: 12,
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
