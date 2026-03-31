'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export default function CustomFieldsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['customFields'], queryFn: () => customFieldsClient.list() });
  const form = useForm<{ key: string; label: string; type: 'text'|'number'|'boolean'|'select'|'date'|'json' }>({ defaultValues: { key: '', label: '', type: 'text' } });
  const create = useMutation({ mutationFn: customFieldsClient.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['customFields'] }) });
  const toggle = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => customFieldsClient.setActive(id, isActive), onSuccess: () => qc.invalidateQueries({ queryKey: ['customFields'] }) });
  return <div style={{display:'grid',gap:16}}>
    <form className='card' onSubmit={form.handleSubmit(async (values) => { await create.mutateAsync(values); form.reset(); })} style={{display:'grid',gap:8}}>
      <h3>Create Custom Field</h3>
      <Input {...form.register('key')} placeholder='key (snake_case)' /><Input {...form.register('label')} placeholder='Label' />
      <Select {...form.register('type')}><option>text</option><option>number</option><option>boolean</option><option>select</option><option>date</option><option>json</option></Select>
      <Button>Create</Button>
    </form>
    <div className='card'><h3>Custom Fields</h3><table className='table'><thead><tr><th>Key</th><th>Type</th><th>Props</th><th>Active</th></tr></thead><tbody>{data?.data.map((f) => <tr key={f.id}><td>{f.label}<br/><small>{f.key}</small></td><td>{f.type}</td><td>required:{String(f.isRequired)} | filterable:{String(f.isFilterable)} | visibleInList:{String(f.isVisibleInList)} | sort:{f.sortOrder}</td><td><Button onClick={() => toggle.mutate({ id: f.id, isActive: !f.isActive })}>{f.isActive ? 'Disable' : 'Enable'}</Button></td></tr>)}</tbody></table></div>
  </div>;
}
