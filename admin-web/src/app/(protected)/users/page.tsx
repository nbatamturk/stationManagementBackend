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
import { useAuth } from '@/lib/auth/auth-context';
import { usersClient } from '@/lib/api/users-client';

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersClient.list({ page: 1, limit: 50 }),
    enabled: isAdmin,
  });
  const form = useForm({ defaultValues: { email: '', fullName: '', password: '', role: 'viewer', isActive: true } });
  const create = useMutation({
    mutationFn: usersClient.create,
    onSuccess: async () => {
      form.reset({ email: '', fullName: '', password: '', role: 'viewer', isActive: true });
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersClient.setActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <RequireRole roles={['admin']} title='Admin only' description='User management is restricted to administrators.'>
      <div className='page-stack'>
        <PageHeader
          title='Users'
          description='Manage internal access without leaving the operations panel.'
        />

        <form
          className='card page-stack'
          onSubmit={form.handleSubmit(async (values) => {
            await create.mutateAsync({ ...values, role: values.role as 'admin' | 'operator' | 'viewer' });
          })}
        >
          <div>
            <h3>Create user</h3>
            <p className='muted'>Provision new internal accounts with the current backend contract.</p>
          </div>
          <div className='form-grid'>
            <div className='field'>
              <label htmlFor='user-email'>Email</label>
              <Input id='user-email' {...form.register('email')} />
            </div>
            <div className='field'>
              <label htmlFor='user-full-name'>Full name</label>
              <Input id='user-full-name' {...form.register('fullName')} />
            </div>
            <div className='field'>
              <label htmlFor='user-password'>Password</label>
              <Input id='user-password' type='password' {...form.register('password')} />
            </div>
            <div className='field'>
              <label htmlFor='user-role'>Role</label>
              <Select id='user-role' {...form.register('role')}>
                <option value='admin'>admin</option>
                <option value='operator'>operator</option>
                <option value='viewer'>viewer</option>
              </Select>
            </div>
          </div>
          {create.error ? <p className='form-error'>{(create.error as Error).message}</p> : null}
          <div className='section-actions'>
            <Button disabled={create.isPending} type='submit'>
              {create.isPending ? 'Creating...' : 'Create user'}
            </Button>
          </div>
        </form>

        {isLoading ? <StateCard title='Loading users' description='Fetching the latest user list.' /> : null}
        {error ? <StateCard title='Users unavailable' description={(error as Error).message} tone='danger' /> : null}

        {!isLoading && !error ? (
          <TableShell title='Users' description='Current admin, operator, and viewer access states.'>
            <div className='table-wrap'>
              <table className='table'>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.data.map((user) => (
                    <tr key={user.id}>
                      <td>{user.fullName}</td>
                      <td>{user.email}</td>
                      <td><Badge tone='info'>{user.role}</Badge></td>
                      <td><Badge tone={user.isActive ? 'success' : 'warning'}>{user.isActive ? 'Active' : 'Inactive'}</Badge></td>
                      <td>
                        <Button
                          variant='secondary'
                          onClick={() => toggle.mutate({ id: user.id, isActive: !user.isActive })}
                        >
                          {user.isActive ? 'Deactivate' : 'Activate'}
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
