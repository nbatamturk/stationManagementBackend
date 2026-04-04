'use client';

import { ReactNode, useEffect, useMemo, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { CustomField, Station, StationConfig, StationWritePayload } from '@/types/api';
import { parseDateInputValue, stringifyJson, toDateInputValue } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ConnectorFieldsEditor } from './connector-fields-editor';
import {
  ConnectorFormValue,
  connectorsFormSchema,
  deriveConnectorFields,
  formatConnectorCount,
  formatPowerKw,
  getConnectorCurrentMixLabel,
  getConnectorTypesLabel,
  toConnectorFormValue,
} from './connector-form';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  code: z.string().trim().min(2, 'Code is required'),
  qrCode: z.string().trim().min(2, 'QR code is required'),
  brandId: z.string().regex(UUID_PATTERN, 'Brand is required'),
  modelId: z.string().regex(UUID_PATTERN, 'Model is required'),
  serialNumber: z.string().trim().min(2, 'Serial number is required'),
  location: z.string().trim().min(2, 'Location is required').max(500, 'Location is too long'),
  status: z.enum(['active', 'maintenance', 'inactive', 'faulty']),
  lastTestDate: z.string().optional(),
  notes: z.string().max(2000, 'Notes are too long').optional(),
  connectors: connectorsFormSchema,
  customFields: z.record(z.string()),
});

type FormValues = z.infer<typeof schema>;

function getInitialCustomFieldValue(field: CustomField, initial?: Partial<Station>) {
  const value = initial?.customFields?.[field.key];

  if (value === undefined || value === null) {
    return '';
  }

  if (field.type === 'boolean') {
    return String(Boolean(value));
  }

  if (field.type === 'date' && typeof value === 'string') {
    return toDateInputValue(value);
  }

  if (field.type === 'json') {
    return stringifyJson(value);
  }

  return String(value);
}

function normalizeCustomFieldValue(field: CustomField, rawValue: string) {
  if (rawValue.trim() === '') {
    return null;
  }

  switch (field.type) {
    case 'number':
      return Number(rawValue);
    case 'boolean':
      return rawValue === 'true';
    case 'date':
      return parseDateInputValue(rawValue);
    case 'json':
      return JSON.parse(rawValue);
    default:
      return rawValue;
  }
}

function getSelectOptions(field: CustomField) {
  if (!field.options || typeof field.options !== 'object' || field.options === null || !('options' in field.options)) {
    return [];
  }

  const rawOptions = (field.options as { options?: unknown }).options;
  return Array.isArray(rawOptions) ? rawOptions.filter((option): option is string => typeof option === 'string') : [];
}

function validateCustomFieldValue(field: CustomField, rawValue: string) {
  if (rawValue.trim() === '') {
    return field.isRequired ? `${field.label} is required.` : true;
  }

  if (field.type === 'number' && !Number.isFinite(Number(rawValue))) {
    return `${field.label} must be a valid number.`;
  }

  if (field.type === 'json') {
    try {
      JSON.parse(rawValue);
    } catch {
      return `Enter valid JSON for ${field.label}.`;
    }
  }

  return true;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function buildEditableBrands(config: StationConfig, initial?: Partial<Station>) {
  const brands = [...config.brands];

  if (initial?.brandId && !brands.some((brand) => brand.id === initial.brandId)) {
    brands.push({
      id: initial.brandId,
      name: initial.brand ?? 'Unknown brand',
      isActive: false,
      createdAt: '',
      updatedAt: '',
    });
  }

  return brands;
}

function buildEditableModels(config: StationConfig, initial?: Partial<Station>) {
  const models = [...config.models];

  if (initial?.modelId && !models.some((model) => model.id === initial.modelId)) {
    models.push({
      id: initial.modelId,
      brandId: initial.brandId ?? '',
      name: initial.model ?? 'Unknown model',
      description: null,
      imageUrl: null,
      isActive: false,
      createdAt: '',
      updatedAt: '',
      latestTemplateVersion: null,
      latestTemplateConnectors: [],
    });
  }

  return models;
}

function resolveInitialBrandId(initial: Partial<Station> | undefined, brands: StationConfig['brands']) {
  if (isUuid(initial?.brandId)) {
    return initial.brandId;
  }

  if (!initial?.brand) {
    return '';
  }

  return brands.find((brand) => brand.name === initial.brand)?.id ?? '';
}

function resolveInitialModelId(
  initial: Partial<Station> | undefined,
  models: StationConfig['models'],
  brandId: string,
) {
  if (isUuid(initial?.modelId)) {
    return initial.modelId;
  }

  if (!initial?.model) {
    return '';
  }

  return (
    models.find((model) => model.name === initial.model && (!brandId || model.brandId === brandId))?.id ??
    models.find((model) => model.name === initial.model)?.id ??
    ''
  );
}

function getDefaultValues(initial: Partial<Station> | undefined, customFields: CustomField[], config: StationConfig): FormValues {
  const editableBrands = buildEditableBrands(config, initial);
  const editableModels = buildEditableModels(config, initial);
  const resolvedBrandId = resolveInitialBrandId(initial, editableBrands);
  const resolvedModelId = resolveInitialModelId(initial, editableModels, resolvedBrandId);

  return {
    name: initial?.name ?? '',
    code: initial?.code ?? '',
    qrCode: initial?.qrCode ?? '',
    brandId: resolvedBrandId,
    modelId: resolvedModelId,
    serialNumber: initial?.serialNumber ?? '',
    location: initial?.location ?? '',
    status: initial?.status ?? 'active',
    lastTestDate: toDateInputValue(initial?.lastTestDate),
    notes: initial?.notes ?? '',
    connectors: (initial?.connectors ?? []).map((connector) => toConnectorFormValue(connector)),
    customFields: Object.fromEntries(customFields.map((field) => [field.key, getInitialCustomFieldValue(field, initial)])),
  };
}

export function StationForm({
  initial,
  customFields,
  config,
  onSubmit,
  actionSlot,
}: {
  initial?: Partial<Station>;
  customFields: CustomField[];
  config: StationConfig;
  onSubmit: (data: StationWritePayload) => Promise<void>;
  actionSlot?: ReactNode;
}) {
  const [submitError, setSubmitError] = useState('');
  const [templateDraftMessage, setTemplateDraftMessage] = useState('');
  const editableBrands = useMemo(() => buildEditableBrands(config, initial), [config, initial]);
  const editableModels = useMemo(() => buildEditableModels(config, initial), [config, initial]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: getDefaultValues(initial, customFields, config),
  });
  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: 'connectors',
  });
  const selectedBrandId = useWatch({ control: form.control, name: 'brandId' });
  const selectedModelId = useWatch({ control: form.control, name: 'modelId' });
  const watchedConnectors = useWatch({ control: form.control, name: 'connectors' });
  const customFieldErrors = form.formState.errors.customFields as Record<string, { message?: string }> | undefined;

  const brandOptions = useMemo(
    () =>
      [...editableBrands]
        .filter((brand) => brand.isActive || brand.id === selectedBrandId || brand.id === initial?.brandId)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [editableBrands, initial?.brandId, selectedBrandId],
  );
  const modelOptions = useMemo(
    () =>
      [...editableModels]
        .filter(
          (model) =>
            model.brandId === selectedBrandId &&
            (model.isActive || model.id === selectedModelId || model.id === initial?.modelId),
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [editableModels, initial?.modelId, selectedBrandId, selectedModelId],
  );
  const selectedModel = useMemo(
    () => editableModels.find((model) => model.id === selectedModelId) ?? null,
    [editableModels, selectedModelId],
  );
  const selectedBrand = useMemo(
    () => editableBrands.find((brand) => brand.id === selectedBrandId) ?? null,
    [editableBrands, selectedBrandId],
  );
  const derivedFields = useMemo(
    () => deriveConnectorFields((watchedConnectors ?? []) as ConnectorFormValue[]),
    [watchedConnectors],
  );
  const selectedModelTemplateFields = useMemo(
    () =>
      selectedModel
        ? deriveConnectorFields(selectedModel.latestTemplateConnectors.map((connector) => toConnectorFormValue(connector)))
        : null,
    [selectedModel],
  );

  useEffect(() => {
    if (!selectedModelId) {
      return;
    }

    const isModelVisible = modelOptions.some((model) => model.id === selectedModelId);

    if (!isModelVisible) {
      form.setValue('modelId', '');
    }
  }, [form, modelOptions, selectedModelId]);

  useEffect(() => {
    setTemplateDraftMessage('');
  }, [selectedModelId]);

  return (
    <form
      className='card page-stack'
      onSubmit={form.handleSubmit(async (values) => {
        try {
          setSubmitError('');

          const customPayload: Record<string, unknown> = {};

          for (const field of customFields) {
            const rawValue = values.customFields[field.key] ?? '';
            customPayload[field.key] = normalizeCustomFieldValue(field, rawValue);
          }

          await onSubmit({
            name: values.name,
            code: values.code,
            qrCode: values.qrCode,
            brandId: values.brandId,
            modelId: values.modelId,
            serialNumber: values.serialNumber,
            location: values.location,
            status: values.status,
            lastTestDate: parseDateInputValue(values.lastTestDate ?? ''),
            notes: values.notes?.trim() ? values.notes : null,
            connectors: values.connectors.map((connector) => ({
              connectorNo: connector.connectorNo,
              connectorType: connector.connectorType,
              currentType: connector.currentType,
              powerKw: connector.powerKw,
              sortOrder: connector.sortOrder,
              isActive: connector.isActive,
            })),
            customFields: customPayload,
          });
        } catch (error) {
          setSubmitError((error as Error).message);
        }
      })}
    >
      <div className='page-header'>
        <div>
          <h1>{initial?.id ? 'Edit station' : 'Create station'}</h1>
          <p className='muted'>Keep station identity, catalog mapping, and connector setup in one practical form.</p>
        </div>
        <div className='page-header-actions'>
          {initial?.status ? <Badge>{initial.status}</Badge> : null}
          {actionSlot}
        </div>
      </div>

      {submitError ? <p className='form-error'>{submitError}</p> : null}

      <section className='form-section'>
        <div>
          <h3>Identity</h3>
          <p className='muted'>Core identifiers used across search, labels, and operational tracking.</p>
        </div>
        <div className='form-grid'>
          <div className='field'>
            <label htmlFor='name'>Name</label>
            <Input id='name' {...form.register('name')} />
            {form.formState.errors.name ? <p className='form-error'>{form.formState.errors.name.message}</p> : null}
          </div>
          <div className='field'>
            <label htmlFor='code'>Code</label>
            <Input id='code' {...form.register('code')} />
            {form.formState.errors.code ? <p className='form-error'>{form.formState.errors.code.message}</p> : null}
          </div>
          <div className='field'>
            <label htmlFor='qrCode'>QR code</label>
            <Input id='qrCode' {...form.register('qrCode')} />
            {form.formState.errors.qrCode ? <p className='form-error'>{form.formState.errors.qrCode.message}</p> : null}
          </div>
          <div className='field'>
            <label htmlFor='serialNumber'>Serial number</label>
            <Input id='serialNumber' {...form.register('serialNumber')} />
            {form.formState.errors.serialNumber ? <p className='form-error'>{form.formState.errors.serialNumber.message}</p> : null}
          </div>
          <div className='field'>
            <label htmlFor='brandId'>Brand</label>
            <Select id='brandId' {...form.register('brandId')} disabled={brandOptions.length === 0}>
              <option value=''>Select a brand</option>
              {brandOptions.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}{brand.isActive ? '' : ' (Inactive)'}
                </option>
              ))}
            </Select>
            {form.formState.errors.brandId ? <p className='form-error'>{form.formState.errors.brandId.message}</p> : null}
            {brandOptions.length === 0 ? (
              <p className='field-hint'>No active catalog brands are available yet. Ask an admin to add one in Station Catalog.</p>
            ) : null}
          </div>
          <div className='field'>
            <label htmlFor='modelId'>Model</label>
            <Select id='modelId' {...form.register('modelId')} disabled={!selectedBrandId || modelOptions.length === 0}>
              <option value=''>{selectedBrandId ? 'Select a model' : 'Choose a brand first'}</option>
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}{model.isActive ? '' : ' (Inactive)'}
                </option>
              ))}
            </Select>
            {form.formState.errors.modelId ? <p className='form-error'>{form.formState.errors.modelId.message}</p> : null}
            {selectedBrandId && modelOptions.length === 0 ? (
              <p className='field-hint'>No active models are available for the selected brand yet.</p>
            ) : null}
          </div>
        </div>

        {selectedBrand || selectedModel ? (
          <div className='subtle-box page-stack'>
            <div className='inline-cluster'>
              {selectedBrand ? <Badge tone={selectedBrand.isActive ? 'info' : 'warning'}>{selectedBrand.name}</Badge> : null}
              {selectedModel ? <Badge tone={selectedModel.isActive ? 'success' : 'warning'}>{selectedModel.name}</Badge> : null}
              {selectedModel ? (
                <Badge>{selectedModel.latestTemplateVersion ? `Template v${selectedModel.latestTemplateVersion}` : 'No template yet'}</Badge>
              ) : null}
            </div>
            {selectedModel?.description ? <p className='muted'>{selectedModel.description}</p> : null}
            {selectedModel && !selectedModel.description ? <p className='muted'>No model description is stored yet.</p> : null}
            {selectedModelTemplateFields ? (
              <div className='detail-grid'>
                <div className='subtle-box'>
                  <p className='eyebrow'>Template rows</p>
                  <strong>{formatConnectorCount(selectedModelTemplateFields.summary.count)}</strong>
                  <p className='muted'>{getConnectorTypesLabel(selectedModelTemplateFields.summary)}</p>
                </div>
                <div className='subtle-box'>
                  <p className='eyebrow'>Current mix</p>
                  <strong>{getConnectorCurrentMixLabel(selectedModelTemplateFields.summary)}</strong>
                  <p className='muted'>Previewed from the latest stored model template.</p>
                </div>
                <div className='subtle-box'>
                  <p className='eyebrow'>Max power</p>
                  <strong>
                    {selectedModelTemplateFields.summary.count > 0
                      ? `${formatPowerKw(selectedModelTemplateFields.summary.maxPowerKw)} kW`
                      : 'Not derived'}
                  </strong>
                  <p className='muted'>Read-only template compatibility summary.</p>
                </div>
              </div>
            ) : null}
            {selectedModel ? (
              <>
                <div className='section-actions'>
                  <Button
                    type='button'
                    variant='secondary'
                    disabled={selectedModel.latestTemplateConnectors.length === 0}
                    onClick={() => {
                      if (selectedModel.latestTemplateConnectors.length === 0) {
                        return;
                      }

                      const confirmed = window.confirm(
                        'Replace the current draft connector rows with the latest template from the selected model? Unsaved connector edits in this form will be overwritten.',
                      );

                      if (!confirmed) {
                        return;
                      }

                      replace(selectedModel.latestTemplateConnectors.map((connector) => toConnectorFormValue(connector)));
                      setTemplateDraftMessage(
                        selectedModel.latestTemplateVersion
                          ? `Loaded template v${selectedModel.latestTemplateVersion} into the form. Save the station to persist these connector rows.`
                          : 'Loaded the selected model template into the form. Save the station to persist these connector rows.',
                      );
                    }}
                  >
                    Load selected model template
                  </Button>
                </div>
                <p className='field-hint'>
                  {selectedModel.latestTemplateConnectors.length === 0
                    ? 'This model has no stored connector template yet.'
                    : 'This replaces only the draft connector rows in this form until you save.'}
                </p>
              </>
            ) : null}
            {templateDraftMessage ? <p className='muted' role='status'>{templateDraftMessage}</p> : null}
          </div>
        ) : null}
      </section>

      <section className='form-section'>
        <div>
          <h3>Operations</h3>
          <p className='muted'>Station state plus the backend-derived top-level compatibility fields.</p>
        </div>
        <div className='form-grid'>
          <div className='field'>
            <label htmlFor='status'>Status</label>
            <Select id='status' {...form.register('status')}>
              {config.statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
          <div className='field'>
            <label htmlFor='lastTestDate'>Last test date</label>
            <Input id='lastTestDate' type='date' {...form.register('lastTestDate')} />
          </div>
          <div className='field'>
            <label htmlFor='location'>Location</label>
            <Input id='location' {...form.register('location')} />
            {form.formState.errors.location ? <p className='form-error'>{form.formState.errors.location.message}</p> : null}
          </div>
          <div className='field'>
            <label htmlFor='derivedCurrentType'>Derived current type</label>
            <Input id='derivedCurrentType' value={derivedFields.currentType ?? 'Not derived yet'} readOnly />
            <p className='field-hint'>Read-only. Derived from the connector rows below.</p>
          </div>
          <div className='field'>
            <label htmlFor='derivedSocketType'>Derived socket types</label>
            <Input id='derivedSocketType' value={derivedFields.socketType || 'Not derived yet'} readOnly />
            <p className='field-hint'>Read-only. Derived from the connector type mix.</p>
          </div>
          <div className='field'>
            <label htmlFor='derivedPowerKw'>Derived max power (kW)</label>
            <Input
              id='derivedPowerKw'
              value={derivedFields.powerKw === null ? 'Not derived yet' : formatPowerKw(derivedFields.powerKw)}
              readOnly
            />
            <p className='field-hint'>Read-only. Derived from the highest connector power.</p>
          </div>
        </div>
        <div className='field'>
          <label htmlFor='notes'>Notes</label>
          <Textarea id='notes' {...form.register('notes')} placeholder='Operational notes, caveats, or handover context' />
          {form.formState.errors.notes ? <p className='form-error'>{form.formState.errors.notes.message}</p> : null}
        </div>
      </section>

      <ConnectorFieldsEditor
        fields={fields}
        register={form.register}
        append={append}
        remove={remove}
        errors={form.formState.errors}
        values={(watchedConnectors ?? []) as ConnectorFormValue[]}
      />

      <section className='form-section'>
        <div>
          <h3>Custom fields</h3>
          <p className='muted'>Only the currently active custom definitions are shown here.</p>
        </div>
        {customFields.length === 0 ? (
          <p className='muted'>No active custom fields are configured.</p>
        ) : (
          <div className='field-grid'>
            {customFields.map((field) => {
              const fieldName = `customFields.${field.key}` as const;
              const options = getSelectOptions(field);

              return (
                <div key={field.id} className='field'>
                  <label htmlFor={field.key}>
                    {field.label} {field.isRequired ? <Badge tone='warning'>Required</Badge> : null}
                  </label>
                  {field.type === 'select' ? (
                    <Select
                      id={field.key}
                      {...form.register(fieldName, { validate: (value) => validateCustomFieldValue(field, value) })}
                    >
                      <option value=''>Select an option</option>
                      {options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </Select>
                  ) : null}
                  {field.type === 'boolean' ? (
                    <Select
                      id={field.key}
                      {...form.register(fieldName, { validate: (value) => validateCustomFieldValue(field, value) })}
                    >
                      <option value=''>Not set</option>
                      <option value='true'>Yes</option>
                      <option value='false'>No</option>
                    </Select>
                  ) : null}
                  {field.type === 'date' ? (
                    <Input
                      id={field.key}
                      type='date'
                      {...form.register(fieldName, { validate: (value) => validateCustomFieldValue(field, value) })}
                    />
                  ) : null}
                  {field.type === 'json' ? (
                    <Textarea
                      id={field.key}
                      {...form.register(fieldName, { validate: (value) => validateCustomFieldValue(field, value) })}
                      placeholder='Enter valid JSON'
                    />
                  ) : null}
                  {field.type === 'text' ? (
                    <Textarea
                      id={field.key}
                      {...form.register(fieldName, { validate: (value) => validateCustomFieldValue(field, value) })}
                      placeholder={field.label}
                    />
                  ) : null}
                  {field.type === 'number' ? (
                    <Input
                      id={field.key}
                      type='number'
                      step='0.01'
                      {...form.register(fieldName, { validate: (value) => validateCustomFieldValue(field, value) })}
                    />
                  ) : null}
                  {field.type !== 'select' &&
                  field.type !== 'boolean' &&
                  field.type !== 'date' &&
                  field.type !== 'json' &&
                  field.type !== 'text' &&
                  field.type !== 'number' ? (
                    <Input
                      id={field.key}
                      {...form.register(fieldName, { validate: (value) => validateCustomFieldValue(field, value) })}
                    />
                  ) : null}
                  {customFieldErrors?.[field.key]?.message ? (
                    <p className='form-error'>{String(customFieldErrors[field.key]?.message)}</p>
                  ) : null}
                  <p className='field-hint'>{field.type.toUpperCase()} field · key: {field.key}</p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className='section-actions'>
        <Button disabled={form.formState.isSubmitting} type='submit'>
          {form.formState.isSubmitting ? 'Saving...' : initial?.id ? 'Save station' : 'Create station'}
        </Button>
      </div>
    </form>
  );
}
