import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppScreen,
  AppTextInput,
  CatalogAssetPreview,
  EmptyState,
  LoadingState,
  OptionChip,
  colors,
} from '@/components';
import { useAuth } from '@/features/auth';
import { getCustomFieldDefinitions } from '@/features/custom-fields';
import {
  applyStationModelTemplate,
  getStationByIdForForm,
  getStationConfig,
  upsertStation,
} from '@/features/stations';
import { connectorTypeOptions, createEmptyConnectorFormValue, currentTypeOptions, deriveConnectorFields, getNextConnectorNumber, toConnectorFormValue } from '@/features/stations/helpers';
import type { StationFormRecord } from '@/features/stations';
import { isApiError } from '@/lib/api/errors';
import type {
  CustomFieldDefinition,
  StationCatalogBrand,
  StationCatalogModel,
  StationConfig,
  StationConnectorFormValue,
  StationCustomValuesByFieldId,
  StationDraft,
  StationFormValues,
} from '@/types';
import { isValidDateOnly, isoToDateOnly } from '@/utils/date';
import { parseSelectOptions } from '@/utils/custom-field';
import { STATION_STATUS_LABELS, getStationDisplayStatus, stationEditableStatusOptions } from '@/utils/station';

type FormErrors = Partial<Record<Exclude<keyof StationFormValues, 'connectors'>, string>> & {
  connectors?: string;
};

type ConnectorFieldError = {
  connectorNo?: string;
  powerKw?: string;
};

const createDefaultFormValues = (prefilledQrCode = ''): StationFormValues => ({
  name: '',
  code: '',
  qrCode: prefilledQrCode.trim(),
  brandId: '',
  modelId: '',
  serialNumber: '',
  location: '',
  status: 'active',
  lastTestDate: '',
  notes: '',
  connectors: [],
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
  brandId: station.brandId,
  modelId: station.modelId,
  serialNumber: station.serialNumber,
  location: station.location,
  status: station.status,
  lastTestDate: isoToDateOnly(station.lastTestDate),
  notes: station.notes ?? '',
  connectors: (station.connectors ?? []).map((connector) => toConnectorFormValue(connector)),
});

const validateForm = (
  formValues: StationFormValues,
  definitions: CustomFieldDefinition[],
  customValues: StationCustomValuesByFieldId,
): {
  connectorErrors: ConnectorFieldError[];
  customFieldErrors: Record<string, string>;
  formErrors: FormErrors;
} => {
  const formErrors: FormErrors = {};
  const customFieldErrors: Record<string, string> = {};
  const connectorErrors: ConnectorFieldError[] = [];

  if (formValues.name.trim().length < 2) {
    formErrors.name = 'Station name must be at least 2 characters.';
  }

  if (formValues.code.trim().length < 2) {
    formErrors.code = 'Station code must be at least 2 characters.';
  }

  if (formValues.qrCode.trim().length < 2) {
    formErrors.qrCode = 'QR code must be at least 2 characters.';
  }

  if (!formValues.brandId) {
    formErrors.brandId = 'Brand selection is required.';
  }

  if (!formValues.modelId) {
    formErrors.modelId = 'Model selection is required.';
  }

  if (formValues.serialNumber.trim().length < 2) {
    formErrors.serialNumber = 'Serial number must be at least 2 characters.';
  }

  if (formValues.location.trim().length < 2) {
    formErrors.location = 'Location must be at least 2 characters.';
  }

  if (formValues.lastTestDate.trim() && !isValidDateOnly(formValues.lastTestDate.trim())) {
    formErrors.lastTestDate = 'Use YYYY-MM-DD format.';
  }

  if (formValues.notes.trim().length > 2000) {
    formErrors.notes = 'Notes must be 2000 characters or fewer.';
  }

  if (formValues.connectors.length === 0) {
    formErrors.connectors = 'At least one connector is required.';
  }

  const usedConnectorNumbers = new Set<number>();

  formValues.connectors.forEach((connector, index) => {
    const fieldError: ConnectorFieldError = {};
    const connectorNo = Number(connector.connectorNo.trim());
    const powerKw = Number(connector.powerKw.trim());

    if (!Number.isInteger(connectorNo) || connectorNo < 1) {
      fieldError.connectorNo = 'Connector number must be at least 1.';
    } else if (usedConnectorNumbers.has(connectorNo)) {
      fieldError.connectorNo = `Connector number ${connectorNo} is duplicated.`;
    } else {
      usedConnectorNumbers.add(connectorNo);
    }

    if (!connector.powerKw.trim()) {
      fieldError.powerKw = 'Power is required.';
    } else if (Number.isNaN(powerKw) || !Number.isFinite(powerKw)) {
      fieldError.powerKw = 'Power must be a valid number.';
    } else if (powerKw <= 0 || powerKw > 1000) {
      fieldError.powerKw = 'Power must be between 0 and 1000.';
    }

    connectorErrors[index] = fieldError;
  });

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
    connectorErrors,
    customFieldErrors,
    formErrors,
  };
};

const formatModelChipLabel = (model: StationCatalogModel) => `${model.name}${model.isActive ? '' : ' (Inactive)'}`;
const formatBrandChipLabel = (brand: StationCatalogBrand) => `${brand.name}${brand.isActive ? '' : ' (Inactive)'}`;
const formatCurrentMixLabel = (hasAC: boolean, hasDC: boolean): string => {
  if (hasAC && hasDC) {
    return 'AC + DC';
  }

  return hasDC ? 'DC only' : 'AC only';
};

const ReadOnlyValue = ({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element => (
  <View style={styles.readOnlyValue}>
    <Text style={styles.readOnlyLabel}>{label}</Text>
    <Text style={styles.readOnlyText}>{value || 'Not derived yet'}</Text>
  </View>
);

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
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [station, setStation] = useState<StationFormRecord | null>(null);
  const [stationConfig, setStationConfig] = useState<StationConfig | null>(null);
  const [customDefinitions, setCustomDefinitions] = useState<CustomFieldDefinition[]>([]);
  const [formValues, setFormValues] = useState<StationFormValues>(createDefaultFormValues(prefilledQrCode));
  const [customValues, setCustomValues] = useState<StationCustomValuesByFieldId>({});
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [connectorErrors, setConnectorErrors] = useState<ConnectorFieldError[]>([]);
  const [customFieldErrors, setCustomFieldErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [templateDraftMessage, setTemplateDraftMessage] = useState('');

  const formTitle = isEditMode ? 'Edit Station' : 'Create Station';
  const formSubtitle = isEditMode
    ? 'Update the backend station record, catalog mapping, and connector setup in one field-ready form.'
    : 'Create a new backend station using the station catalog and connector source of truth.';

  const customDefinitionMap = useMemo(
    () => new Map(customDefinitions.map((definition) => [definition.key, definition.id])),
    [customDefinitions],
  );
  const selectedBrand = useMemo(
    () => stationConfig?.brands.find((brand) => brand.id === formValues.brandId) ?? null,
    [formValues.brandId, stationConfig?.brands],
  );
  const selectedModel = useMemo(
    () => stationConfig?.models.find((model) => model.id === formValues.modelId) ?? null,
    [formValues.modelId, stationConfig?.models],
  );
  const selectedModelTemplateFields = useMemo(
    () =>
      selectedModel
        ? deriveConnectorFields(
            selectedModel.latestTemplateConnectors.map((connector) => ({
              ...connector,
              sortOrder: connector.sortOrder ?? connector.connectorNo,
            })),
          )
        : null,
    [selectedModel],
  );
  const selectableBrands = useMemo(() => {
    const brands = stationConfig?.brands ?? [];
    return brands
      .filter((brand) => brand.isActive || brand.id === formValues.brandId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [formValues.brandId, stationConfig?.brands]);
  const selectableModels = useMemo(() => {
    const models = stationConfig?.models ?? [];
    return models
      .filter((model) => model.brandId === formValues.brandId)
      .filter((model) => model.isActive || model.id === formValues.modelId)
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [formValues.brandId, formValues.modelId, stationConfig?.models]);
  const derivedFields = useMemo(
    () =>
      deriveConnectorFields(
        formValues.connectors.map((connector, index) => ({
          connectorNo: Number(connector.connectorNo.trim()),
          connectorType: connector.connectorType,
          currentType: connector.currentType,
          powerKw: Number(connector.powerKw.trim()),
          isActive: connector.isActive,
          sortOrder: index + 1,
        })),
      ),
    [formValues.connectors],
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
    setConnectorErrors([]);
    setCustomFieldErrors({});

    try {
      const [definitions, config, stationResult] = await Promise.all([
        getCustomFieldDefinitions(true),
        getStationConfig(),
        isEditMode ? getStationByIdForForm(stationId) : Promise.resolve(null),
      ]);

      setCustomDefinitions(definitions);
      setStationConfig(config);

      if (!isEditMode) {
        setStation(null);
        setFormValues(createDefaultFormValues(prefilledQrCode));
        setCustomValues(createCustomValueMap(definitions));
        setTemplateDraftMessage('');
        return;
      }

      if (!stationResult) {
        setStation(null);
        setCustomValues(createCustomValueMap(definitions));
        setLoadError('The selected station could not be loaded.');
        setTemplateDraftMessage('');
        return;
      }

      setStation(stationResult);
      setFormValues(mapStationToFormValues(stationResult));
      setCustomValues(createCustomValueMap(definitions, stationResult.customValuesByFieldId));
      setTemplateDraftMessage('');
    } catch (error) {
      setStation(null);
      setStationConfig(null);
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

  const handleFieldChange = <T extends Exclude<keyof StationFormValues, 'connectors'>>(
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

  const handleBrandSelect = (brandId: string): void => {
    setFormValues((prev) => ({
      ...prev,
      brandId,
      modelId: prev.brandId === brandId ? prev.modelId : '',
    }));
    setSubmitError('');
    setTemplateDraftMessage('');
    setFormErrors((prev) => ({
      ...prev,
      brandId: undefined,
      modelId: undefined,
    }));
  };

  const handleModelSelect = (modelId: string): void => {
    setFormValues((prev) => ({
      ...prev,
      modelId,
    }));
    setSubmitError('');
    setTemplateDraftMessage('');
    setFormErrors((prev) => ({
      ...prev,
      modelId: undefined,
    }));
  };

  const handleConnectorChange = (
    index: number,
    patch: Partial<StationConnectorFormValue>,
  ): void => {
    setFormValues((prev) => ({
      ...prev,
      connectors: prev.connectors.map((connector, connectorIndex) =>
        connectorIndex === index ? { ...connector, ...patch } : connector,
      ),
    }));
    setSubmitError('');
    setFormErrors((prev) => ({
      ...prev,
      connectors: undefined,
    }));
    setTemplateDraftMessage('');

    if (connectorErrors[index]) {
      setConnectorErrors((prev) =>
        prev.map((error, errorIndex) => (errorIndex === index ? {} : error)),
      );
    }
  };

  const handleAddConnector = (): void => {
    setFormValues((prev) => ({
      ...prev,
      connectors: [...prev.connectors, createEmptyConnectorFormValue(getNextConnectorNumber(prev.connectors))],
    }));
    setFormErrors((prev) => ({
      ...prev,
      connectors: undefined,
    }));
    setTemplateDraftMessage('');
  };

  const handleRemoveConnector = (index: number): void => {
    setFormValues((prev) => ({
      ...prev,
      connectors: prev.connectors.filter((_, connectorIndex) => connectorIndex !== index),
    }));
    setConnectorErrors((prev) => prev.filter((_, connectorIndex) => connectorIndex !== index));
    setSubmitError('');
    setTemplateDraftMessage('');
  };

  const moveConnector = (index: number, direction: -1 | 1): void => {
    setFormValues((prev) => {
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= prev.connectors.length) {
        return prev;
      }

      const nextConnectors = [...prev.connectors];
      const [moved] = nextConnectors.splice(index, 1);

      nextConnectors.splice(nextIndex, 0, moved!);

      return {
        ...prev,
        connectors: nextConnectors,
      };
    });
    setSubmitError('');
    setTemplateDraftMessage('');
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

  const handleLoadModelTemplate = (): void => {
    if (!selectedModel || selectedModel.latestTemplateConnectors.length === 0) {
      return;
    }

    Alert.alert(
      'Load Model Template',
      'Replace the current connector rows in this form with the latest template from the selected catalog model? Unsaved connector edits in this form will be overwritten.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Load Template',
          onPress: () => {
            setFormValues((prev) => ({
              ...prev,
              connectors: selectedModel.latestTemplateConnectors.map((connector) => toConnectorFormValue(connector)),
            }));
            setFormErrors((prev) => ({
              ...prev,
              connectors: undefined,
            }));
            setConnectorErrors([]);
            setSubmitError('');
            setTemplateDraftMessage(
              selectedModel.latestTemplateVersion
                ? `Loaded template v${selectedModel.latestTemplateVersion} into the form. Save the station to persist these connector rows.`
                : 'Loaded the selected model template into the form. Save the station to persist these connector rows.',
            );
          },
        },
      ],
    );
  };

  const handleApplyTemplate = (): void => {
    if (!station || applyingTemplate) {
      return;
    }

    Alert.alert(
      'Apply Model Template',
      'Replace the saved station connectors in backend records with the latest template from the selected model?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Apply Template',
          onPress: () => {
            void (async () => {
              setApplyingTemplate(true);
              setSubmitError('');

              try {
                await applyStationModelTemplate(station.id);
                await loadForm();
              } catch (error) {
                setSubmitError(
                  error instanceof Error
                    ? `Could not apply model template: ${error.message}`
                    : 'Could not apply model template.',
                );
              } finally {
                setApplyingTemplate(false);
              }
            })();
          },
        },
      ],
    );
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
    setConnectorErrors(validation.connectorErrors);
    setCustomFieldErrors(validation.customFieldErrors);
    setSubmitError('');

    if (
      Object.keys(validation.formErrors).length > 0 ||
      Object.values(validation.connectorErrors).some((fieldError) => Object.keys(fieldError).length > 0) ||
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
              No backend station matched this QR code. Pick the correct catalog model before
              creating a new station.
            </Text>
          </View>
        ) : null}

        {station ? (
          <View style={styles.summaryBanner}>
            <Text style={styles.summaryBannerTitle}>
              {station.name} · {STATION_STATUS_LABELS[getStationDisplayStatus(station.status, station.isArchived)]}
            </Text>
            <Text style={styles.summaryBannerText}>
              {station.modelTemplateVersion
                ? `Applied template v${station.modelTemplateVersion}.`
                : 'Current connectors were edited manually.'}
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
          label="Serial Number"
          required
          value={formValues.serialNumber}
          onChangeText={(value) => handleFieldChange('serialNumber', value)}
          placeholder="Example: VST-EVC06-0009"
          autoCapitalize="none"
          error={formErrors.serialNumber}
        />

        <View style={styles.formGroup}>
          <Text style={styles.filterLabel}>Brand</Text>
          {selectableBrands.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {selectableBrands.map((brand) => (
                <OptionChip
                  key={brand.id}
                  label={formatBrandChipLabel(brand)}
                  selected={formValues.brandId === brand.id}
                  onPress={() => handleBrandSelect(brand.id)}
                />
              ))}
            </ScrollView>
          ) : (
            <EmptyState
              title="No catalog brands"
              description="No station brands are available in backend config yet. Add catalog brands before creating stations from mobile."
            />
          )}
          {selectedBrand ? <Text style={styles.helperText}>Selected brand: {selectedBrand.name}</Text> : null}
          {formErrors.brandId ? <Text style={styles.errorText}>{formErrors.brandId}</Text> : null}
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.filterLabel}>Model</Text>
          {formValues.brandId ? (
            selectableModels.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {selectableModels.map((model) => (
                  <OptionChip
                    key={model.id}
                    label={formatModelChipLabel(model)}
                    selected={formValues.modelId === model.id}
                    onPress={() => handleModelSelect(model.id)}
                  />
                ))}
              </ScrollView>
            ) : (
              <EmptyState
                title="No models for this brand"
                description="Select another brand or add a compatible catalog model before creating this station."
              />
            )
          ) : (
            <Text style={styles.helperText}>Select a brand first.</Text>
          )}
          {selectedModel ? <Text style={styles.helperText}>Selected model: {selectedModel.name}</Text> : null}
          {formErrors.modelId ? <Text style={styles.errorText}>{formErrors.modelId}</Text> : null}
        </View>

        {selectedModel ? (
          <View style={styles.catalogSummaryCard}>
            <View style={styles.catalogSummaryHeader}>
              <View style={styles.catalogSummaryText}>
                <Text style={styles.sectionTitle}>Selected Catalog Model</Text>
                <Text style={styles.sectionSubtitle}>
                  Brand and model selection never changes connectors automatically. Load the
                  model template only when you want to replace the current draft connector rows.
                </Text>
              </View>
              <AppButton
                label="Load Model Template"
                variant="secondary"
                onPress={handleLoadModelTemplate}
                disabled={selectedModel.latestTemplateConnectors.length === 0 || submitting || applyingTemplate}
              />
            </View>

            <View style={styles.catalogStateRow}>
              <View
                style={[
                  styles.catalogStatePill,
                  selectedModel.isActive ? styles.catalogStatePillInfo : styles.catalogStatePillWarning,
                ]}
              >
                <Text style={styles.catalogStatePillText}>
                  {selectedBrand?.name ?? 'Catalog brand'} {selectedModel.name}
                </Text>
              </View>
              <View
                style={[
                  styles.catalogStatePill,
                  selectedModel.isActive ? styles.catalogStatePillSuccess : styles.catalogStatePillWarning,
                ]}
              >
                <Text style={styles.catalogStatePillText}>
                  {selectedModel.isActive ? 'Active catalog model' : 'Inactive catalog model'}
                </Text>
              </View>
              <View style={[styles.catalogStatePill, styles.catalogStatePillNeutral]}>
                <Text style={styles.catalogStatePillText}>
                  {selectedModel.latestTemplateVersion
                    ? `Template v${selectedModel.latestTemplateVersion}`
                    : 'No template yet'}
                </Text>
              </View>
            </View>

            <Text style={styles.catalogDescription}>
              {selectedModel.description || 'No model description is configured in the catalog yet.'}
            </Text>

            {selectedModel.imageUrl ? (
              <View style={styles.catalogMediaRow}>
                <CatalogAssetPreview
                  label="Model Image"
                  uri={selectedModel.imageUrl}
                  emptyText="No model image is configured."
                  failureText="The model image could not be loaded."
                  frameMinHeight={180}
                />
              </View>
            ) : null}

            {selectedModelTemplateFields ? (
              <View style={styles.templateSummaryGrid}>
                <ReadOnlyValue
                  label="Template Connector Count"
                  value={`${selectedModelTemplateFields.summary.count}`}
                />
                <ReadOnlyValue
                  label="Template Current Mix"
                  value={formatCurrentMixLabel(
                    selectedModelTemplateFields.summary.hasAC,
                    selectedModelTemplateFields.summary.hasDC,
                  )}
                />
                <ReadOnlyValue
                  label="Template Connector Types"
                  value={selectedModelTemplateFields.socketType || 'No connector types yet'}
                />
                <ReadOnlyValue
                  label="Template Max Power"
                  value={
                    selectedModelTemplateFields.powerKw
                      ? `${selectedModelTemplateFields.powerKw} kW`
                      : 'Not derived yet'
                  }
                />
              </View>
            ) : null}

            <Text style={styles.helperText}>
              {selectedModel.latestTemplateConnectors.length === 0
                ? 'This model has no connector template yet. Add connectors manually if the backend station should be created now.'
                : 'Loading the template replaces only the draft connector rows in this form until you save.'}
            </Text>
            {templateDraftMessage ? <Text style={styles.successText}>{templateDraftMessage}</Text> : null}
          </View>
        ) : null}

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

      <AppCard style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Derived Electrical Summary</Text>
            <Text style={styles.sectionSubtitle}>
              These top-level values are derived from the connector list and are read-only on mobile.
            </Text>
          </View>
          {isEditMode && station ? (
            <AppButton
              label={applyingTemplate ? 'Applying...' : 'Apply To Saved Station'}
              variant="secondary"
              onPress={handleApplyTemplate}
              disabled={
                applyingTemplate || !selectedModel || selectedModel.latestTemplateConnectors.length === 0
              }
            />
          ) : null}
        </View>
        {isEditMode && station ? (
          <Text style={styles.helperText}>
            This server action replaces the saved station connectors in backend records and reloads
            the form.
          </Text>
        ) : null}
        <ReadOnlyValue label="Connector Count" value={`${derivedFields.summary.count}`} />
        <ReadOnlyValue label="Derived Current Type" value={derivedFields.currentType ?? ''} />
        <ReadOnlyValue
          label="Derived Socket Types"
          value={derivedFields.socketType || 'No connector types yet'}
        />
        <ReadOnlyValue
          label="Derived Max Power"
          value={derivedFields.powerKw ? `${derivedFields.powerKw} kW` : ''}
        />
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Connectors</Text>
            <Text style={styles.sectionSubtitle}>
              Connector rows are the writable source of truth for this station.
            </Text>
          </View>
          <AppButton label="Add Connector" variant="secondary" onPress={handleAddConnector} />
        </View>

        {formErrors.connectors ? <Text style={styles.errorText}>{formErrors.connectors}</Text> : null}

        {formValues.connectors.length === 0 ? (
          <Text style={styles.helperText}>
            {selectedModel?.latestTemplateConnectors.length
              ? 'No connectors added yet. Load the selected model template or add connector rows manually.'
              : 'No connectors added yet. Add connector rows manually or choose a model with a template.'}
          </Text>
        ) : (
          formValues.connectors.map((connector, index) => (
            <View key={`${index}-${connector.connectorNo}`} style={styles.connectorCard}>
              <View style={styles.connectorHeader}>
                <Text style={styles.connectorTitle}>Connector {index + 1}</Text>
                <View style={styles.connectorActions}>
                  <Pressable
                    onPress={() => moveConnector(index, -1)}
                    disabled={index === 0}
                    style={({ pressed }) => [
                      styles.connectorAction,
                      index === 0 && styles.connectorActionDisabled,
                      pressed && index !== 0 && styles.pressed,
                    ]}
                  >
                    <Text style={styles.connectorActionText}>Up</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => moveConnector(index, 1)}
                    disabled={index === formValues.connectors.length - 1}
                    style={({ pressed }) => [
                      styles.connectorAction,
                      index === formValues.connectors.length - 1 && styles.connectorActionDisabled,
                      pressed && index !== formValues.connectors.length - 1 && styles.pressed,
                    ]}
                  >
                    <Text style={styles.connectorActionText}>Down</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => handleRemoveConnector(index)}
                    style={({ pressed }) => [styles.connectorActionDanger, pressed && styles.pressed]}
                  >
                    <Text style={styles.connectorActionDangerText}>Remove</Text>
                  </Pressable>
                </View>
              </View>

              <AppTextInput
                label="Connector Number"
                value={connector.connectorNo}
                onChangeText={(value) => handleConnectorChange(index, { connectorNo: value })}
                keyboardType="numeric"
                autoCapitalize="none"
                error={connectorErrors[index]?.connectorNo}
              />

              <AppTextInput
                label="Power (kW)"
                value={connector.powerKw}
                onChangeText={(value) => handleConnectorChange(index, { powerKw: value })}
                keyboardType="numeric"
                autoCapitalize="none"
                error={connectorErrors[index]?.powerKw}
              />

              <View style={styles.connectorOptionGroup}>
                <Text style={styles.filterLabel}>Connector Type</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {connectorTypeOptions.map((option) => (
                    <OptionChip
                      key={option}
                      label={option}
                      selected={connector.connectorType === option}
                      onPress={() => handleConnectorChange(index, { connectorType: option })}
                    />
                  ))}
                </ScrollView>
              </View>

              <View style={styles.connectorOptionGroup}>
                <Text style={styles.filterLabel}>Current Type</Text>
                <View style={styles.inlineRow}>
                  {currentTypeOptions.map((option) => (
                    <OptionChip
                      key={option}
                      label={option}
                      selected={connector.currentType === option}
                      onPress={() => handleConnectorChange(index, { currentType: option })}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.connectorOptionGroup}>
                <Text style={styles.filterLabel}>State</Text>
                <View style={styles.inlineRow}>
                  <OptionChip
                    label="Active"
                    selected={connector.isActive}
                    onPress={() => handleConnectorChange(index, { isActive: true })}
                  />
                  <OptionChip
                    label="Inactive"
                    selected={!connector.isActive}
                    onPress={() => handleConnectorChange(index, { isActive: false })}
                  />
                </View>
              </View>
            </View>
          ))
        )}
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
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
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
                    <Text style={styles.helperText}>No select options are configured for this field yet.</Text>
                  )}
                  {fieldError ? <Text style={styles.errorText}>{fieldError}</Text> : null}
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
                  placeholder={
                    definition.type === 'date'
                      ? 'YYYY-MM-DD'
                      : definition.type === 'json'
                        ? '{"key":"value"}'
                        : 'Enter value'
                  }
                  keyboardType={definition.type === 'number' ? 'numeric' : undefined}
                  autoCapitalize="none"
                  multiline={definition.type === 'json'}
                  error={fieldError}
                />
              </View>
            );
          })}
        </AppCard>
      ) : null}

      <View style={styles.actionColumn}>
        <AppButton
          label={
            submitting
              ? isEditMode
                ? 'Saving Changes...'
                : 'Creating Station...'
              : isEditMode
                ? 'Save Changes'
                : 'Create Station'
          }
          onPress={() => {
            void handleSubmit();
          }}
          disabled={submitting || applyingTemplate}
        />
        <AppButton
          label="Cancel"
          variant="secondary"
          onPress={handleCancel}
          disabled={submitting || applyingTemplate}
        />
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
  summaryBanner: {
    borderRadius: 12,
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: '#D6E4FF',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  summaryBannerTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryBannerText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  catalogSummaryCard: {
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#F8FBFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  catalogSummaryHeader: {
    gap: 10,
  },
  catalogSummaryText: {
    gap: 4,
  },
  catalogStateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catalogStatePill: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  catalogStatePillInfo: {
    backgroundColor: '#EEF4FF',
  },
  catalogStatePillSuccess: {
    backgroundColor: '#EEF7EE',
  },
  catalogStatePillWarning: {
    backgroundColor: '#FFF7E6',
  },
  catalogStatePillNeutral: {
    backgroundColor: '#F4F6FA',
  },
  catalogStatePillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  catalogDescription: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 20,
  },
  catalogMediaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  templateSummaryGrid: {
    gap: 10,
  },
  sectionHeaderRow: {
    gap: 12,
  },
  sectionHeaderText: {
    gap: 4,
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
  chipRow: {
    gap: 8,
    paddingRight: 6,
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  successText: {
    color: '#0F9D58',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  readOnlyValue: {
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FBFCFF',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  readOnlyLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '600',
  },
  readOnlyText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  connectorCard: {
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FBFCFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  connectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  connectorTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  connectorActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectorAction: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: colors.surface,
  },
  connectorActionDisabled: {
    opacity: 0.45,
  },
  connectorActionText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  connectorActionDanger: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3C7C7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#FFF4F4',
  },
  connectorActionDangerText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  connectorOptionGroup: {
    gap: 8,
  },
  customFieldBlock: {
    gap: 8,
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
  pressed: {
    opacity: 0.82,
  },
});
