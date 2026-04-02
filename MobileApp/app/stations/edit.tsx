import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppScreen,
  AppTextInput,
  EmptyState,
  LoadingState,
  OptionChip,
  colors,
} from '@/components';
import { useAuth } from '@/features/auth';
import { getCustomFieldDefinitions } from '@/features/custom-fields';
import { getStationByIdForForm, upsertStation } from '@/features/stations';
import type {
  CustomFieldDefinition,
  StationCustomValuesByFieldId,
  StationDraft,
  StationFormValues,
} from '@/types';
import type { StationFormRecord } from '@/features/stations';
import { isValidDateOnly, isoToDateOnly } from '@/utils/date';
import { parseSelectOptions } from '@/utils/custom-field';
import {
  STATION_STATUS_LABELS,
  currentTypeOptions,
  stationEditableStatusOptions,
  stationSocketTypeOptions,
} from '@/utils/station';
import { isApiError } from '@/lib/api/errors';

type FormErrors = Partial<Record<keyof StationFormValues, string>>;

const createDefaultFormValues = (prefilledQrCode = ''): StationFormValues => ({
  name: '',
  code: '',
  qrCode: prefilledQrCode.trim(),
  brand: '',
  model: '',
  serialNumber: '',
  powerKw: '',
  currentType: 'AC',
  socketType: 'Type2',
  location: '',
  status: 'active',
  lastTestDate: '',
  notes: '',
});

const createCustomValueMap = (
  definitions: CustomFieldDefinition[],
  values?: StationCustomValuesByFieldId,
): StationCustomValuesByFieldId => {
  const nextValues: StationCustomValuesByFieldId = {};

  for (const definition of definitions) {
    nextValues[definition.id] = values?.[definition.id] ?? '';
  }

  return nextValues;
};

const mapStationToFormValues = (station: StationFormRecord): StationFormValues => ({
  name: station.name,
  code: station.code,
  qrCode: station.qrCode,
  brand: station.brand,
  model: station.model,
  serialNumber: station.serialNumber,
  powerKw: String(station.powerKw),
  currentType: station.currentType,
  socketType: stationSocketTypeOptions.includes(station.socketType as (typeof stationSocketTypeOptions)[number])
    ? (station.socketType as (typeof stationSocketTypeOptions)[number])
    : 'Type2',
  location: station.location,
  status:
    station.status === 'active' ||
    station.status === 'maintenance' ||
    station.status === 'inactive' ||
    station.status === 'faulty'
      ? station.status
      : 'inactive',
  lastTestDate: isoToDateOnly(station.lastTestDate),
  notes: station.notes ?? '',
});

const validateForm = (
  formValues: StationFormValues,
  definitions: CustomFieldDefinition[],
  customValues: StationCustomValuesByFieldId,
): {
  customFieldErrors: Record<string, string>;
  formErrors: FormErrors;
} => {
  const formErrors: FormErrors = {};
  const customFieldErrors: Record<string, string> = {};

  if (formValues.name.trim().length < 2) {
    formErrors.name = 'Station name must be at least 2 characters.';
  }

  if (formValues.code.trim().length < 2) {
    formErrors.code = 'Station code must be at least 2 characters.';
  }

  if (formValues.qrCode.trim().length < 2) {
    formErrors.qrCode = 'QR code must be at least 2 characters.';
  }

  if (formValues.brand.trim().length < 1) {
    formErrors.brand = 'Brand is required.';
  }

  if (formValues.model.trim().length < 1) {
    formErrors.model = 'Model is required.';
  }

  if (formValues.serialNumber.trim().length < 2) {
    formErrors.serialNumber = 'Serial number must be at least 2 characters.';
  }

  if (formValues.location.trim().length < 2) {
    formErrors.location = 'Location must be at least 2 characters.';
  }

  const parsedPowerKw = Number(formValues.powerKw.trim());
  if (!formValues.powerKw.trim()) {
    formErrors.powerKw = 'Power (kW) is required.';
  } else if (Number.isNaN(parsedPowerKw) || !Number.isFinite(parsedPowerKw)) {
    formErrors.powerKw = 'Power (kW) must be a valid number.';
  } else if (parsedPowerKw < 0 || parsedPowerKw > 1000) {
    formErrors.powerKw = 'Power (kW) must be between 0 and 1000.';
  }

  if (formValues.lastTestDate.trim() && !isValidDateOnly(formValues.lastTestDate.trim())) {
    formErrors.lastTestDate = 'Use YYYY-MM-DD format.';
  }

  if (formValues.notes.trim().length > 2000) {
    formErrors.notes = 'Notes must be 2000 characters or fewer.';
  }

  for (const definition of definitions) {
    const value = customValues[definition.id] ?? '';
    const normalizedValue = value.trim();

    if (definition.isRequired && !normalizedValue) {
      customFieldErrors[definition.id] = `${definition.label} is required.`;
      continue;
    }

    if (!normalizedValue) {
      continue;
    }

    switch (definition.type) {
      case 'number':
        if (Number.isNaN(Number(normalizedValue))) {
          customFieldErrors[definition.id] = `${definition.label} must be a valid number.`;
        }
        break;
      case 'boolean':
        if (!['true', 'false'].includes(normalizedValue)) {
          customFieldErrors[definition.id] = `${definition.label} must be Yes, No, or unset.`;
        }
        break;
      case 'date':
        if (!isValidDateOnly(normalizedValue)) {
          customFieldErrors[definition.id] = `${definition.label} must use YYYY-MM-DD format.`;
        }
        break;
      case 'select': {
        const options = parseSelectOptions(definition.optionsJson);

        if (options.length > 0 && !options.includes(normalizedValue)) {
          customFieldErrors[definition.id] = `${definition.label} must match a configured option.`;
        }
        break;
      }
      case 'json':
        try {
          JSON.parse(normalizedValue);
        } catch {
          customFieldErrors[definition.id] = `${definition.label} must contain valid JSON.`;
        }
        break;
      case 'text':
        if (normalizedValue.length > 2000) {
          customFieldErrors[definition.id] = `${definition.label} must be 2000 characters or fewer.`;
        }
        break;
    }
  }

  return {
    customFieldErrors,
    formErrors,
  };
};

export default function AddEditStationScreen(): React.JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ qrCode?: string; stationId?: string }>();
  const { user } = useAuth();

  const stationId = typeof params.stationId === 'string' ? params.stationId : '';
  const prefilledQrCode = typeof params.qrCode === 'string' ? params.qrCode : '';
  const isEditMode = Boolean(stationId);
  const canWriteStations = user?.role === 'admin' || user?.role === 'operator';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [station, setStation] = useState<StationFormRecord | null>(null);
  const [customDefinitions, setCustomDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [formValues, setFormValues] = useState<StationFormValues>(createDefaultFormValues(prefilledQrCode));
  const [customValues, setCustomValues] = useState<StationCustomValuesByFieldId>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');

  const formTitle = isEditMode ? 'Edit Station' : 'Create Station';
  const formSubtitle = isEditMode
    ? 'Update this backend station record with clear, field-ready details.'
    : 'Create a new station directly in backend records.';

  const customDefinitionMap = useMemo(
    () => new Map(customDefinitions.map((definition) => [definition.key, definition.id])),
    [customDefinitions],
  );

  const loadForm = useCallback(async () => {
    if (!canWriteStations) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    setSubmitError('');
    setFormErrors({});
    setCustomFieldErrors({});

    try {
      const definitions = await getCustomFieldDefinitions(true);
      setCustomDefinitions(definitions);

      if (!isEditMode) {
        setStation(null);
        setFormValues(createDefaultFormValues(prefilledQrCode));
        setCustomValues(createCustomValueMap(definitions));
        return;
      }

      const stationResult = await getStationByIdForForm(stationId);

      if (!stationResult) {
        setStation(null);
        setCustomValues(createCustomValueMap(definitions));
        setLoadError('The selected station could not be loaded.');
        return;
      }

      setStation(stationResult);
      setFormValues(mapStationToFormValues(stationResult));
      setCustomValues(createCustomValueMap(definitions, stationResult.customValuesByFieldId));
    } catch (error) {
      setStation(null);
      setCustomDefinitions([]);
      setCustomValues({});
      setLoadError(
        error instanceof Error
          ? `Could not prepare station form: ${error.message}`
          : 'Could not prepare station form.',
      );
    } finally {
      setLoading(false);
    }
  }, [canWriteStations, isEditMode, prefilledQrCode, stationId]);

  useFocusEffect(
    useCallback(() => {
      void loadForm();
    }, [loadForm]),
  );

  const handleFieldChange = <T extends keyof StationFormValues>(
    field: T,
    value: StationFormValues[T],
  ): void => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
    setSubmitError('');

    if (formErrors[field]) {
      setFormErrors((prev) => ({
        ...prev,
        [field]: undefined,
      }));
    }
  };

  const handleCustomValueChange = (fieldId: string, value: string): void => {
    setCustomValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
    setSubmitError('');

    if (customFieldErrors[fieldId]) {
      setCustomFieldErrors((prev) => {
        const nextErrors = { ...prev };
        delete nextErrors[fieldId];
        return nextErrors;
      });
    }
  };

  const handleCancel = (): void => {
    if (stationId) {
      router.replace({ pathname: '/stations/[id]', params: { id: stationId } });
      return;
    }

    router.replace('/stations');
  };

  const handleSubmit = async (): Promise<void> => {
    if (submitting) {
      return;
    }

    if (!canWriteStations) {
      setSubmitError('Your role does not allow creating or editing stations.');
      return;
    }

    const validation = validateForm(formValues, customDefinitions, customValues);
    setFormErrors(validation.formErrors);
    setCustomFieldErrors(validation.customFieldErrors);
    setSubmitError('');

    if (
      Object.keys(validation.formErrors).length > 0 ||
      Object.keys(validation.customFieldErrors).length > 0
    ) {
      return;
    }

    setSubmitting(true);

    try {
      const draft: StationDraft = {
        ...formValues,
        id: stationId || undefined,
      };
      const nextStationId = await upsertStation(draft, customValues);
      router.replace({ pathname: '/stations/[id]', params: { id: nextStationId } });
    } catch (error) {
      if (isApiError(error)) {
        if (error.code === 'STATION_CODE_EXISTS') {
          setFormErrors((prev) => ({ ...prev, code: error.message }));
          setSubmitting(false);
          return;
        }

        if (error.code === 'STATION_QR_EXISTS') {
          setFormErrors((prev) => ({ ...prev, qrCode: error.message }));
          setSubmitting(false);
          return;
        }

        if (error.code === 'STATION_SERIAL_EXISTS') {
          setFormErrors((prev) => ({ ...prev, serialNumber: error.message }));
          setSubmitting(false);
          return;
        }

        if (error.code === 'CUSTOM_FIELD_REQUIRED') {
          const details =
            typeof error.details === 'object' && error.details !== null
              ? (error.details as { missingKeys?: unknown })
              : null;
          const missingKeys = Array.isArray(details?.missingKeys)
            ? details.missingKeys.filter((item): item is string => typeof item === 'string')
            : [];

          if (missingKeys.length > 0) {
            const nextErrors: Record<string, string> = {};

            for (const key of missingKeys) {
              const fieldId = customDefinitionMap.get(key);

              if (fieldId) {
                nextErrors[fieldId] = 'This custom field is required.';
              }
            }

            if (Object.keys(nextErrors).length > 0) {
              setCustomFieldErrors(nextErrors);
              setSubmitting(false);
              return;
            }
          }
        }
      }

      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Station could not be saved. Check the form and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!canWriteStations) {
    return (
      <AppScreen contentContainerStyle={styles.centeredContent}>
        <AppCard style={styles.card}>
          <Text style={styles.title}>Station Editing Is Restricted</Text>
          <Text style={styles.body}>
            Only admin and operator users can create or edit stations from mobile.
          </Text>
          <View style={styles.actions}>
            {stationId ? (
              <AppButton
                label="Back To Station Detail"
                onPress={() =>
                  router.replace({ pathname: '/stations/[id]', params: { id: stationId } })
                }
              />
            ) : null}
            <AppButton label="Open Station List" variant="secondary" onPress={handleCancel} />
          </View>
        </AppCard>
      </AppScreen>
    );
  }

  if (loading) {
    return (
      <AppScreen>
        <LoadingState label={isEditMode ? 'Loading station form...' : 'Preparing station form...'} />
      </AppScreen>
    );
  }

  if (isEditMode && !station) {
    return (
      <AppScreen>
        <EmptyState
          title="Station unavailable"
          description={loadError || 'The selected station could not be loaded.'}
          actionLabel="Open Station List"
          onActionPress={() => router.replace('/stations')}
        />
      </AppScreen>
    );
  }

  if (station?.isArchived) {
    return (
      <AppScreen contentContainerStyle={styles.centeredContent}>
        <AppCard style={styles.card}>
          <Text style={styles.title}>Archived Stations Are Read-Only</Text>
          <Text style={styles.body}>
            This station is archived in backend records and cannot be edited from mobile.
          </Text>
          <View style={styles.actions}>
            <AppButton
              label="Back To Station Detail"
              onPress={() => router.replace({ pathname: '/stations/[id]', params: { id: station.id } })}
            />
            <AppButton label="Open Station List" variant="secondary" onPress={handleCancel} />
          </View>
        </AppCard>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppCard style={styles.card}>
        <Text style={styles.title}>{formTitle}</Text>
        <Text style={styles.subtitle}>{formSubtitle}</Text>

        {prefilledQrCode && !isEditMode ? (
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Scanned QR Prefilled</Text>
            <Text style={styles.infoText}>
              No backend station matched this QR code. Review the details carefully before creating
              a new backend station.
            </Text>
          </View>
        ) : null}

        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <AppTextInput
          label="Station Name"
          required
          value={formValues.name}
          onChangeText={(value) => handleFieldChange('name', value)}
          placeholder="Example: Istanbul R&D Bay 9"
          error={formErrors.name}
        />

        <AppTextInput
          label="Station Code"
          required
          value={formValues.code}
          onChangeText={(value) => handleFieldChange('code', value)}
          placeholder="Example: IST-RD-009"
          autoCapitalize="none"
          error={formErrors.code}
        />

        <AppTextInput
          label="QR Code"
          required
          value={formValues.qrCode}
          onChangeText={(value) => handleFieldChange('qrCode', value)}
          placeholder="Example: QR-IST-RD-009"
          autoCapitalize="none"
          error={formErrors.qrCode}
        />

        <AppTextInput
          label="Brand"
          required
          value={formValues.brand}
          onChangeText={(value) => handleFieldChange('brand', value)}
          placeholder="Example: ABB"
          error={formErrors.brand}
        />

        <AppTextInput
          label="Model"
          required
          value={formValues.model}
          onChangeText={(value) => handleFieldChange('model', value)}
          placeholder="Example: Terra 184"
          error={formErrors.model}
        />

        <AppTextInput
          label="Serial Number"
          required
          value={formValues.serialNumber}
          onChangeText={(value) => handleFieldChange('serialNumber', value)}
          placeholder="Example: ABB-TR184-9001"
          autoCapitalize="none"
          error={formErrors.serialNumber}
        />

        <AppTextInput
          label="Power (kW)"
          required
          value={formValues.powerKw}
          onChangeText={(value) => handleFieldChange('powerKw', value)}
          placeholder="Example: 180"
          keyboardType="numeric"
          autoCapitalize="none"
          error={formErrors.powerKw}
        />

        <View style={styles.formGroup}>
          <Text style={styles.filterLabel}>Current Type</Text>
          <View style={styles.inlineRow}>
            {currentTypeOptions.map((option) => (
              <OptionChip
                key={option}
                label={option}
                selected={formValues.currentType === option}
                onPress={() => handleFieldChange('currentType', option)}
              />
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.filterLabel}>Socket Type</Text>
          <View style={styles.inlineRow}>
            {stationSocketTypeOptions.map((option) => (
              <OptionChip
                key={option}
                label={option}
                selected={formValues.socketType === option}
                onPress={() => handleFieldChange('socketType', option)}
              />
            ))}
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.filterLabel}>Status</Text>
          <View style={styles.inlineRow}>
            {stationEditableStatusOptions.map((option) => (
              <OptionChip
                key={option}
                label={STATION_STATUS_LABELS[option]}
                selected={formValues.status === option}
                onPress={() => handleFieldChange('status', option)}
              />
            ))}
          </View>
        </View>

        <AppTextInput
          label="Location"
          required
          value={formValues.location}
          onChangeText={(value) => handleFieldChange('location', value)}
          placeholder="Example: Istanbul HQ - Test Hall B"
          error={formErrors.location}
        />

        <AppTextInput
          label="Last Test Date"
          value={formValues.lastTestDate}
          onChangeText={(value) => handleFieldChange('lastTestDate', value)}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
          error={formErrors.lastTestDate}
        />

        <AppTextInput
          label="Notes"
          value={formValues.notes}
          onChangeText={(value) => handleFieldChange('notes', value)}
          placeholder="Optional notes"
          multiline
          error={formErrors.notes}
        />
      </AppCard>

      {customDefinitions.length > 0 ? (
        <AppCard style={styles.card}>
          <Text style={styles.sectionTitle}>Custom Fields</Text>
          <Text style={styles.sectionSubtitle}>
            Active backend custom fields are rendered here and saved with the station record.
          </Text>

          {customDefinitions.map((definition) => {
            const currentValue = customValues[definition.id] ?? '';
            const fieldError = customFieldErrors[definition.id];

            if (definition.type === 'boolean') {
              return (
                <View key={definition.id} style={styles.customFieldBlock}>
                  <Text style={styles.filterLabel}>
                    {definition.label}
                    {definition.isRequired ? <Text style={styles.required}> *</Text> : null}
                  </Text>
                  <View style={styles.inlineRow}>
                    <OptionChip
                      label="Unset"
                      selected={!currentValue}
                      onPress={() => handleCustomValueChange(definition.id, '')}
                    />
                    <OptionChip
                      label="Yes"
                      selected={currentValue === 'true'}
                      onPress={() => handleCustomValueChange(definition.id, 'true')}
                    />
                    <OptionChip
                      label="No"
                      selected={currentValue === 'false'}
                      onPress={() => handleCustomValueChange(definition.id, 'false')}
                    />
                  </View>
                  {fieldError ? <Text style={styles.errorText}>{fieldError}</Text> : null}
                </View>
              );
            }

            if (definition.type === 'select') {
              const options = parseSelectOptions(definition.optionsJson);

              return (
                <View key={definition.id} style={styles.customFieldBlock}>
                  <Text style={styles.filterLabel}>
                    {definition.label}
                    {definition.isRequired ? <Text style={styles.required}> *</Text> : null}
                  </Text>
                  {options.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.chipRow}
                    >
                      <OptionChip
                        label="Unset"
                        selected={!currentValue}
                        onPress={() => handleCustomValueChange(definition.id, '')}
                      />
                      {options.map((option) => (
                        <OptionChip
                          key={option}
                          label={option}
                          selected={currentValue === option}
                          onPress={() => handleCustomValueChange(definition.id, option)}
                        />
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={styles.helperText}>
                      No select options are configured for this field yet.
                    </Text>
                  )}
                  {fieldError ? <Text style={styles.errorText}>{fieldError}</Text> : null}
                </View>
              );
            }

            if (definition.type === 'number') {
              return (
                <View key={definition.id} style={styles.customFieldBlock}>
                  <AppTextInput
                    label={definition.isRequired ? `${definition.label}` : definition.label}
                    required={definition.isRequired}
                    value={currentValue}
                    onChangeText={(value) => handleCustomValueChange(definition.id, value)}
                    placeholder="Enter a numeric value"
                    keyboardType="numeric"
                    autoCapitalize="none"
                    error={fieldError}
                  />
                </View>
              );
            }

            if (definition.type === 'date') {
              return (
                <View key={definition.id} style={styles.customFieldBlock}>
                  <AppTextInput
                    label={definition.label}
                    required={definition.isRequired}
                    value={currentValue}
                    onChangeText={(value) => handleCustomValueChange(definition.id, value)}
                    placeholder="YYYY-MM-DD"
                    autoCapitalize="none"
                    error={fieldError}
                  />
                </View>
              );
            }

            if (definition.type === 'json') {
              return (
                <View key={definition.id} style={styles.customFieldBlock}>
                  <AppTextInput
                    label={definition.label}
                    required={definition.isRequired}
                    value={currentValue}
                    onChangeText={(value) => handleCustomValueChange(definition.id, value)}
                    placeholder='{"key":"value"}'
                    autoCapitalize="none"
                    multiline
                    error={fieldError}
                  />
                </View>
              );
            }

            return (
              <View key={definition.id} style={styles.customFieldBlock}>
                <AppTextInput
                  label={definition.label}
                  required={definition.isRequired}
                  value={currentValue}
                  onChangeText={(value) => handleCustomValueChange(definition.id, value)}
                  placeholder="Enter value"
                  autoCapitalize="none"
                  error={fieldError}
                />
              </View>
            );
          })}
        </AppCard>
      ) : null}

      <View style={styles.actionColumn}>
        <AppButton
          label={submitting ? (isEditMode ? 'Saving Changes...' : 'Creating Station...') : isEditMode ? 'Save Changes' : 'Create Station'}
          onPress={() => {
            void handleSubmit();
          }}
          disabled={submitting}
        />
        <AppButton label="Cancel" variant="secondary" onPress={handleCancel} disabled={submitting} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    justifyContent: 'center',
  },
  card: {
    gap: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedText,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.mutedText,
  },
  infoBox: {
    borderRadius: 12,
    backgroundColor: '#F4F8FF',
    borderWidth: 1,
    borderColor: '#D6E4FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  infoTitle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  infoText: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
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
  chipRow: {
    gap: 8,
    paddingRight: 6,
  },
  customFieldBlock: {
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  required: {
    color: colors.danger,
  },
  actionColumn: {
    gap: 10,
  },
  actions: {
    gap: 10,
  },
});
