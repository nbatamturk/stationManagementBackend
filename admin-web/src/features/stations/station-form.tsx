'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CustomField, Station } from '@/types/api';
import { parseDateInputValue, stringifyJson, toDateInputValue } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const schema = z.object({
  name: z.string().trim().min(2, 'Name is required'),
  code: z.string().trim().min(2, 'Code is required'),
  qrCode: z.string().trim().min(2, 'QR code is required'),
  brand: z.string().trim().min(1, 'Brand is required'),
  model: z.string().trim().min(1, 'Model is required'),
  serialNumber: z.string().trim().min(2, 'Serial number is required'),
  powerKw: z.coerce.number().min(0, 'Power must be 0 or higher').max(1000, 'Power must be 1000 kW or less'),
  currentType: z.enum(['AC', 'DC']),
  socketType: z.enum(['Type2', 'CCS2', 'CHAdeMO', 'GBT', 'NACS', 'Other']),
  location: z.string().trim().min(2, 'Location is required').max(500, 'Location is too long'),
  status: z.enum(['active', 'maintenance', 'inactive', 'faulty']),
  lastTestDate: z.string().optional(),
  notes: z.string().max(2000, 'Notes are too long').optional(),
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

export function StationForm({
  initial,
  customFields,
  onSubmit,
}: {
  initial?: Partial<Station>;
  customFields: CustomField[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [submitError, setSubmitError] = useState('');
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      code: initial?.code ?? '',
      qrCode: initial?.qrCode ?? '',
      brand: initial?.brand ?? '',
      model: initial?.model ?? '',
      serialNumber: initial?.serialNumber ?? '',
      powerKw: initial?.powerKw ?? 0,
      currentType: initial?.currentType ?? 'AC',
      socketType: initial?.socketType ?? 'Type2',
      location: initial?.location ?? '',
      status: initial?.status ?? 'active',
      lastTestDate: toDateInputValue(initial?.lastTestDate),
      notes: initial?.notes ?? '',
      customFields: Object.fromEntries(customFields.map((field) => [field.key, getInitialCustomFieldValue(field, initial)])),
    },
  });

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
            brand: values.brand,
            model: values.model,
            serialNumber: values.serialNumber,
            powerKw: values.powerKw,
            currentType: values.currentType,
            socketType: values.socketType,
            location: values.location,
            status: values.status,
            lastTestDate: parseDateInputValue(values.lastTestDate ?? ''),
            notes: values.notes?.trim() ? values.notes : null,
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
          <p className='muted'>Keep station identity, health state, and custom field data in one predictable form.</p>
        </div>
        {initial?.status ? <Badge>{initial.status}</Badge> : null}
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
            <label htmlFor='brand'>Brand</label>
            <Input id='brand' {...form.register('brand')} />
            {form.formState.errors.brand ? <p className='form-error'>{form.formState.errors.brand.message}</p> : null}
          </div>
          <div className='field'>
            <label htmlFor='model'>Model</label>
            <Input id='model' {...form.register('model')} />
            {form.formState.errors.model ? <p className='form-error'>{form.formState.errors.model.message}</p> : null}
          </div>
        </div>
      </section>

      <section className='form-section'>
        <div>
          <h3>Operations</h3>
          <p className='muted'>Capacity, connector setup, and current state for field teams.</p>
        </div>
        <div className='form-grid'>
          <div className='field'>
            <label htmlFor='powerKw'>Power (kW)</label>
            <Input id='powerKw' type='number' step='0.1' {...form.register('powerKw')} />
            {form.formState.errors.powerKw ? <p className='form-error'>{form.formState.errors.powerKw.message}</p> : null}
          </div>
          <div className='field'>
            <label htmlFor='currentType'>Current type</label>
            <Select id='currentType' {...form.register('currentType')}>
              <option value='AC'>AC</option>
              <option value='DC'>DC</option>
            </Select>
          </div>
          <div className='field'>
            <label htmlFor='socketType'>Socket type</label>
            <Select id='socketType' {...form.register('socketType')}>
              <option value='Type2'>Type2</option>
              <option value='CCS2'>CCS2</option>
              <option value='CHAdeMO'>CHAdeMO</option>
              <option value='GBT'>GBT</option>
              <option value='NACS'>NACS</option>
              <option value='Other'>Other</option>
            </Select>
          </div>
          <div className='field'>
            <label htmlFor='status'>Status</label>
            <Select id='status' {...form.register('status')}>
              <option value='active'>Active</option>
              <option value='maintenance'>Maintenance</option>
              <option value='inactive'>Inactive</option>
              <option value='faulty'>Faulty</option>
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
        </div>
        <div className='field'>
          <label htmlFor='notes'>Notes</label>
          <Textarea id='notes' {...form.register('notes')} placeholder='Operational notes, caveats, or handover context' />
          {form.formState.errors.notes ? <p className='form-error'>{form.formState.errors.notes.message}</p> : null}
        </div>
      </section>

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
                    <Select id={field.key} {...form.register(fieldName)}>
                      <option value=''>Select an option</option>
                      {options.map((option) => <option key={option} value={option}>{option}</option>)}
                    </Select>
                  ) : null}
                  {field.type === 'boolean' ? (
                    <Select id={field.key} {...form.register(fieldName)}>
                      <option value=''>Not set</option>
                      <option value='true'>Yes</option>
                      <option value='false'>No</option>
                    </Select>
                  ) : null}
                  {field.type === 'date' ? (
                    <Input id={field.key} type='date' {...form.register(fieldName)} />
                  ) : null}
                  {field.type === 'json' ? (
                    <Textarea id={field.key} {...form.register(fieldName)} placeholder='Enter valid JSON' />
                  ) : null}
                  {field.type === 'text' ? (
                    <Textarea id={field.key} {...form.register(fieldName)} placeholder={field.label} />
                  ) : null}
                  {field.type === 'number' ? (
                    <Input id={field.key} type='number' step='0.01' {...form.register(fieldName)} />
                  ) : null}
                  {field.type !== 'select' && field.type !== 'boolean' && field.type !== 'date' && field.type !== 'json' && field.type !== 'text' && field.type !== 'number' ? (
                    <Input id={field.key} {...form.register(fieldName)} />
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
