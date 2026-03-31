'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { usersClient } from '@/lib/api/users-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

export default function UsersPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['users'], queryFn: () => usersClient.list({ page: 1, limit: 50 }) });
  const form = useForm({ defaultValues: { email: '', fullName: '', password: '', role: 'viewer', isActive: true } });
  const create = useMutation({ mutationFn: usersClient.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  const toggle = useMutation({ mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersClient.setActive(id, isActive), onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }) });
  return <div style={{display:'grid',gap:16}}>
    <form className='card' onSubmit={form.handleSubmit(async (values) => { await create.mutateAsync({ ...values, role: values.role as 'admin'|'operator'|'viewer' }); form.reset(); })} style={{display:'grid',gap:8}}>
      <h3>Create User</h3>
      <Input {...form.register('email')} placeholder='Email' /><Input {...form.register('fullName')} placeholder='Full Name' /><Input {...form.register('password')} placeholder='Password' type='password' />
      <Select {...form.register('role')}><option>admin</option><option>operator</option><option>viewer</option></Select>
      <Button>Create User</Button>
    </form>
    <div className='card'><h3>Users</h3><table className='table'><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>{data?.data.map((u) => <tr key={u.id}><td>{u.fullName}</td><td>{u.email}</td><td>{u.role}</td><td>{u.isActive ? 'Active' : 'Inactive'}</td><td><Button onClick={() => toggle.mutate({ id: u.id, isActive: !u.isActive })}>{u.isActive ? 'Deactivate' : 'Activate'}</Button></td></tr>)}</tbody></table></div>
  </div>;
}
