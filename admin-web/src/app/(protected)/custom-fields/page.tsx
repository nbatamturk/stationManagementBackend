'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { RequireRole } from '@/components/auth/require-role';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';
import { TableShell } from '@/components/ui/table-shell';
import { Textarea } from '@/components/ui/textarea';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { useAuth } from '@/lib/auth/auth-context';

export default function CustomFieldsPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['customFields'],
    queryFn: () => customFieldsClient.list(),
    enabled: isAdmin,
  });
  const form = useForm<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
    optionsText: string;
  }>({
    defaultValues: { key: '', label: '', type: 'text', optionsText: '' },
  });
  const create = useMutation({
    mutationFn: customFieldsClient.create,
    onSuccess: async () => {
      form.reset({ key: '', label: '', type: 'text', optionsText: '' });
      await qc.invalidateQueries({ queryKey: ['customFields'] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => customFieldsClient.setActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customFields'] }),
  });

  return (
    <RequireRole roles={['admin']} title='Admin only' description='Custom field configuration is restricted to administrators.'>
      <div className='page-stack'>
        <PageHeader
          title='Custom fields'
          description='Manage the dynamic station field definitions used across lists, filters, and forms.'
        />

        <form
          className='card page-stack'
          onSubmit={form.handleSubmit(async (values) => {
            const payload = {
              key: values.key,
              label: values.label,
              type: values.type,
              ...(values.type === 'select'
                ? { options: { options: values.optionsText.split('\n').map((option) => option.trim()).filter(Boolean) } }
                : {}),
            };
            await create.mutateAsync(payload);
          })}
        >
          <div>
            <h3>Create custom field</h3>
            <p className='muted'>Keep station forms and filters aligned with the backend custom field model.</p>
          </div>
          <div className='form-grid'>
            <div className='field'>
              <label htmlFor='field-key'>Key</label>
              <Input id='field-key' {...form.register('key')} placeholder='snake_case_key' />
            </div>
            <div className='field'>
              <label htmlFor='field-label'>Label</label>
              <Input id='field-label' {...form.register('label')} placeholder='Display label' />
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
          </div>
          {form.watch('type') === 'select' ? (
            <div className='field'>
              <label htmlFor='field-options'>Select options</label>
              <Textarea id='field-options' {...form.register('optionsText')} placeholder={'One option per line\nOperational\nNeeds review'} />
            </div>
          ) : null}
          {create.error ? <p className='form-error'>{(create.error as Error).message}</p> : null}
          <div className='section-actions'>
            <Button disabled={create.isPending} type='submit'>
              {create.isPending ? 'Creating...' : 'Create field'}
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
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((field) => (
                    <tr key={field.id}>
                      <td>
                        <div className='list'>
                          <strong>{field.label}</strong>
                          <span className='muted'>{field.key}</span>
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
                      <td>
                        <Button
                          variant='secondary'
                          onClick={() => toggle.mutate({ id: field.id, isActive: !field.isActive })}
                        >
                          {field.isActive ? 'Disable' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TableShell>
        ) : null}
      </div>
    </RequireRole>
  );
}
