'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { CustomField, Station } from '@/types/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const schema = z.object({
  name: z.string().min(2), code: z.string().min(2), qrCode: z.string().min(2), brand: z.string().min(1), model: z.string().min(1),
  serialNumber: z.string().min(2), powerKw: z.coerce.number().min(0), currentType: z.enum(['AC','DC']), socketType: z.enum(['Type2','CCS2','CHAdeMO','GBT','NACS','Other']),
  location: z.string().min(2), status: z.enum(['active','maintenance','inactive','faulty']), notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function StationForm({ initial, customFields, onSubmit }: { initial?: Partial<Station>; customFields: CustomField[]; onSubmit: (data: Record<string, unknown>) => Promise<void> }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '', code: initial?.code ?? '', qrCode: initial?.qrCode ?? '', brand: initial?.brand ?? '', model: initial?.model ?? '',
      serialNumber: initial?.serialNumber ?? '', powerKw: initial?.powerKw ?? 0, currentType: initial?.currentType ?? 'AC', socketType: initial?.socketType ?? 'Type2',
      location: initial?.location ?? '', status: initial?.status ?? 'active', notes: initial?.notes ?? '',
    },
  });

  return <form className='card' style={{display:'grid',gap:10}} onSubmit={handleSubmit(async (values) => {
    const custom = customFields.reduce((acc, field) => ({ ...acc, [field.key]: (document.getElementById(`cf_${field.key}`) as HTMLInputElement)?.value }), {});
    await onSubmit({ ...values, customFields: custom });
  })}>
    <h3>{initial?.id ? 'Edit Station' : 'Create Station'}</h3>
    {Object.keys(errors).length ? <p style={{color:'red'}}>Please fix form errors.</p> : null}
    <Input {...register('name')} placeholder='Name' /><Input {...register('code')} placeholder='Code' /><Input {...register('qrCode')} placeholder='QR code' />
    <Input {...register('brand')} placeholder='Brand' /><Input {...register('model')} placeholder='Model' /><Input {...register('serialNumber')} placeholder='Serial number' />
    <Input type='number' step='0.1' {...register('powerKw')} placeholder='Power (kW)' /><Input {...register('location')} placeholder='Location' />
    <Select {...register('currentType')}><option value='AC'>AC</option><option value='DC'>DC</option></Select>
    <Select {...register('socketType')}><option>Type2</option><option>CCS2</option><option>CHAdeMO</option><option>GBT</option><option>NACS</option><option>Other</option></Select>
    <Select {...register('status')}><option>active</option><option>maintenance</option><option>inactive</option><option>faulty</option></Select>
    <Input {...register('notes')} placeholder='Notes' />
    <h4>Dynamic Custom Fields</h4>
    {customFields.map((f) => <Input id={`cf_${f.key}`} key={f.id} placeholder={f.label} defaultValue={String(initial?.customFields?.[f.key] ?? '')} />)}
    <Button disabled={isSubmitting} type='submit'>{isSubmitting ? 'Saving...' : 'Save Station'}</Button>
  </form>;
}
