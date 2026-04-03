'use client';

import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { RequireRole } from '@/components/auth/require-role';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';
import { TableShell } from '@/components/ui/table-shell';
import { Textarea } from '@/components/ui/textarea';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { useAuth } from '@/lib/auth/auth-context';
import { useDocumentTitle } from '@/lib/use-document-title';
import {
  CustomField,
  CustomFieldCreatePayload,
  CustomFieldType,
  CustomFieldUpdatePayload,
} from '@/types/api';

type CustomFieldFormValues = {
  key: string;
  label: string;
  type: CustomFieldType;
  optionsText: string;
  isRequired: 'true' | 'false';
  isFilterable: 'true' | 'false';
  isVisibleInList: 'true' | 'false';
  sortOrder: number;
  isActive: 'true' | 'false';
};

const defaultFormValues: CustomFieldFormValues = {
  key: '',
  label: '',
  type: 'text',
  optionsText: '',
  isRequired: 'false',
  isFilterable: 'false',
  isVisibleInList: 'false',
  sortOrder: 0,
  isActive: 'true',
};

const parseBooleanSelect = (value: 'true' | 'false') => value === 'true';

const extractSelectOptions = (options: unknown) => {
  if (!options || typeof options !== 'object' || !('options' in options)) {
    return [];
  }

  const optionsValue = (options as { options?: unknown }).options;

  if (!Array.isArray(optionsValue)) {
    return [];
  }

  return optionsValue.filter((item): item is string => typeof item === 'string');
};

const serializeOptions = (type: CustomFieldType, optionsText: string) => {
  if (type !== 'select') {
    return {};
  }

  return {
    options: optionsText
      .split('\n')
      .map((option) => option.trim())
      .filter(Boolean),
  };
};

const toUpdatePayload = (values: CustomFieldFormValues): CustomFieldUpdatePayload => ({
  label: values.label.trim(),
  type: values.type,
  options: serializeOptions(values.type, values.optionsText),
  isRequired: parseBooleanSelect(values.isRequired),
  isFilterable: parseBooleanSelect(values.isFilterable),
  isVisibleInList: parseBooleanSelect(values.isVisibleInList),
  sortOrder: values.sortOrder,
});

const toCreatePayload = (values: CustomFieldFormValues): CustomFieldCreatePayload => ({
  key: values.key.trim(),
  isActive: parseBooleanSelect(values.isActive),
  ...toUpdatePayload(values),
});

const focusForm = (form: HTMLFormElement | null, fieldId: string) => {
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.requestAnimationFrame(() => {
    const field = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
    field?.focus();
  });
};

const toFormValues = (field: CustomField): CustomFieldFormValues => ({
  key: field.key,
  label: field.label,
  type: field.type,
  optionsText: extractSelectOptions(field.options).join('\n'),
  isRequired: String(field.isRequired) as 'true' | 'false',
  isFilterable: String(field.isFilterable) as 'true' | 'false',
  isVisibleInList: String(field.isVisibleInList) as 'true' | 'false',
  sortOrder: field.sortOrder,
  isActive: String(field.isActive) as 'true' | 'false',
});

export default function CustomFieldsPage() {
  useDocumentTitle('Custom Fields');
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [editingFieldId, setEditingFieldId] = useState('');
  const formRef = useRef<HTMLFormElement | null>(null);
  const { data, isLoading, error } = useQuery({
    queryKey: ['customFields'],
    queryFn: () => customFieldsClient.list(),
    enabled: isAdmin,
  });
  const form = useForm<CustomFieldFormValues>({
    defaultValues: defaultFormValues,
  });
  const fieldMap = useMemo(
    () => new Map((data?.data ?? []).map((field) => [field.id, field])),
    [data?.data],
  );
  const watchedType = form.watch('type');

  const resetForm = () => {
    setEditingFieldId('');
    form.reset(defaultFormValues);
  };

  const startEdit = (field: CustomField) => {
    setEditingFieldId(field.id);
    form.reset(toFormValues(field));
    focusForm(formRef.current, 'field-label');
  };

  const save = useMutation({
    mutationFn: async (values: CustomFieldFormValues) => {
      if (editingFieldId) {
        const updated = await customFieldsClient.update(editingFieldId, toUpdatePayload(values));
        const existing = fieldMap.get(editingFieldId);
        const nextActive = parseBooleanSelect(values.isActive);

        if (existing && existing.isActive !== nextActive) {
          await customFieldsClient.setActive(editingFieldId, nextActive);
        }

        return updated;
      }

      return customFieldsClient.create(toCreatePayload(values));
    },
    onSuccess: async () => {
      resetForm();
      await qc.invalidateQueries({ queryKey: ['customFields'] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => customFieldsClient.setActive(id, isActive),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['customFields'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => customFieldsClient.remove(id),
    onSuccess: async (_response, id) => {
      if (editingFieldId === id) {
        resetForm();
      }

      await qc.invalidateQueries({ queryKey: ['customFields'] });
    },
  });

  return (
    <RequireRole roles={['admin']} title='Admin only' description='Custom field configuration is restricted to administrators.'>
      <div className='page-stack'>
        <PageHeader
          title='Custom fields'
          description='Manage the dynamic station field definitions used across lists, filters, and forms.'
        />

        <form
          ref={formRef}
          className='card page-stack'
          onSubmit={form.handleSubmit(async (values) => {
            await save.mutateAsync(values);
          })}
        >
          <div className='stack-row' style={{ justifyContent: 'space-between' }}>
            <div>
              <h3>{editingFieldId ? 'Edit custom field' : 'Create custom field'}</h3>
              <p className='muted'>Keep station forms and filters aligned with the backend custom field model.</p>
            </div>
            {editingFieldId ? (
              <Button type='button' variant='ghost' onClick={resetForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>

          <div className='form-grid'>
            <div className='field'>
              <label htmlFor='field-key'>Key</label>
              <Input
                id='field-key'
                {...form.register('key', { required: true })}
                placeholder='snake_case_key'
                disabled={Boolean(editingFieldId)}
              />
              {editingFieldId ? <p className='muted'>Field key is locked after creation to protect stored data.</p> : null}
            </div>
            <div className='field'>
              <label htmlFor='field-label'>Label</label>
              <Input id='field-label' {...form.register('label', { required: true })} placeholder='Display label' />
            </div>
            <div className='field'>
              <label htmlFor='field-type'>Type</label>
              <Select id='field-type' {...form.register('type')}>
                <option value='text'>text</option>
                <option value='number'>number</option>
                <option value='boolean'>boolean</option>
                <option value='select'>select</option>
                <option value='date'>date</option>
                <option value='json'>json</option>
              </Select>
            </div>
            <div className='field'>
              <label htmlFor='field-sort-order'>Sort order</label>
              <Input id='field-sort-order' type='number' {...form.register('sortOrder', { valueAsNumber: true })} min={0} max={10000} />
            </div>
            <div className='field'>
              <label htmlFor='field-required'>Required</label>
              <Select id='field-required' {...form.register('isRequired')}>
                <option value='false'>No</option>
                <option value='true'>Yes</option>
              </Select>
            </div>
            <div className='field'>
              <label htmlFor='field-filterable'>Filterable</label>
              <Select id='field-filterable' {...form.register('isFilterable')}>
                <option value='false'>No</option>
                <option value='true'>Yes</option>
              </Select>
            </div>
            <div className='field'>
              <label htmlFor='field-visible'>Visible in list</label>
              <Select id='field-visible' {...form.register('isVisibleInList')}>
                <option value='false'>No</option>
                <option value='true'>Yes</option>
              </Select>
            </div>
            <div className='field'>
              <label htmlFor='field-active'>State</label>
              <Select id='field-active' {...form.register('isActive')}>
                <option value='true'>Active</option>
                <option value='false'>Inactive</option>
              </Select>
            </div>
          </div>

          {watchedType === 'select' ? (
            <div className='field'>
              <label htmlFor='field-options'>Select options</label>
              <Textarea
                id='field-options'
                {...form.register('optionsText')}
                placeholder={'One option per line\nOperational\nNeeds review'}
              />
            </div>
          ) : null}

          {save.error ? <p className='form-error'>{(save.error as Error).message}</p> : null}
          <div className='section-actions'>
            <Button disabled={save.isPending} type='submit'>
              {save.isPending ? 'Saving...' : editingFieldId ? 'Save field' : 'Create field'}
            </Button>
          </div>
        </form>

        {isLoading ? <StateCard title='Loading custom fields' description='Fetching dynamic field definitions.' /> : null}
        {error ? <StateCard title='Custom fields unavailable' description={(error as Error).message} tone='danger' /> : null}

        {!isLoading && !error ? (
          <TableShell title='Custom field definitions' description='Current field behavior that shapes station forms, filters, and list columns.'>
            <div className='table-wrap'>
              <table className='table'>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Type</th>
                    <th>Behavior</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((field) => (
                    <tr key={field.id}>
                      <td>
                        <div className='list'>
                          <strong>{field.label}</strong>
                          <span className='muted'>{field.key}</span>
                          {field.type === 'select' ? (
                            <span className='muted'>
                              {extractSelectOptions(field.options).length > 0
                                ? `Options: ${extractSelectOptions(field.options).join(', ')}`
                                : 'No options stored'}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td><Badge tone='info'>{field.type}</Badge></td>
                      <td>
                        <div className='inline-cluster'>
                          {field.isRequired ? <Badge tone='warning'>Required</Badge> : null}
                          {field.isFilterable ? <Badge>Filterable</Badge> : null}
                          {field.isVisibleInList ? <Badge tone='success'>List column</Badge> : null}
                          <Badge>Sort {field.sortOrder}</Badge>
                        </div>
                      </td>
                      <td><Badge tone={field.isActive ? 'success' : 'warning'}>{field.isActive ? 'Active' : 'Inactive'}</Badge></td>
                      <td>
                        <div className='table-actions'>
                          <Button type='button' variant='secondary' onClick={() => startEdit(field)}>
                            Edit
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            onClick={() => toggle.mutate({ id: field.id, isActive: !field.isActive })}
                            disabled={toggle.isPending}
                          >
                            {field.isActive ? 'Disable' : 'Enable'}
                          </Button>
                          <ConfirmButton
                            label='Delete'
                            variant='danger'
                            disabled={remove.isPending}
                            confirmText={`Delete custom field "${field.label}"? Existing values stored on stations for this field will also be removed.`}
                            onConfirm={() => {
                              remove.mutate(field.id);
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {toggle.error ? <p className='form-error'>{(toggle.error as Error).message}</p> : null}
            {remove.error ? <p className='form-error'>{(remove.error as Error).message}</p> : null}
          </TableShell>
        ) : null}
      </div>
    </RequireRole>
  );
}
