'use client';

import { useState } from 'react';
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
  const [passwordResetSuccess, setPasswordResetSuccess] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersClient.list({ page: 1, limit: 50 }),
    enabled: isAdmin,
  });
  const form = useForm({ defaultValues: { email: '', fullName: '', password: '', role: 'viewer', isActive: true } });
  const passwordResetForm = useForm({
    defaultValues: { userId: '', password: '', confirmPassword: '' },
  });
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
  const resetPassword = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) => usersClient.update(id, { password }),
    onSuccess: async () => {
      passwordResetForm.reset({ userId: '', password: '', confirmPassword: '' });
      setPasswordResetSuccess('User password updated successfully.');
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
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

        <form
          className='card page-stack'
          onSubmit={passwordResetForm.handleSubmit(async (values) => {
            setPasswordResetSuccess('');

            if (values.password !== values.confirmPassword) {
              passwordResetForm.setError('confirmPassword', {
                type: 'validate',
                message: 'Password confirmation does not match.',
              });
              return;
            }

            passwordResetForm.clearErrors('confirmPassword');
            await resetPassword.mutateAsync({ id: values.userId, password: values.password });
          })}
        >
          <div>
            <h3>Set user password</h3>
            <p className='muted'>Admins can directly set a new password for any existing user.</p>
          </div>

          <div className='form-grid'>
            <div className='field'>
              <label htmlFor='password-reset-user'>User</label>
              <Select
                id='password-reset-user'
                {...passwordResetForm.register('userId', {
                  required: 'Select a user.',
                })}
              >
                <option value=''>Select user</option>
                {(data?.data ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName} ({user.email})
                  </option>
                ))}
              </Select>
              {passwordResetForm.formState.errors.userId ? (
                <p className='form-error'>{passwordResetForm.formState.errors.userId.message}</p>
              ) : null}
            </div>

            <div className='field'>
              <label htmlFor='password-reset-new'>New password</label>
              <Input
                id='password-reset-new'
                type='password'
                autoComplete='new-password'
                minLength={8}
                maxLength={128}
                {...passwordResetForm.register('password', {
                  required: 'New password is required.',
                  minLength: {
                    value: 8,
                    message: 'New password must be at least 8 characters.',
                  },
                })}
              />
              {passwordResetForm.formState.errors.password ? (
                <p className='form-error'>{passwordResetForm.formState.errors.password.message}</p>
              ) : null}
            </div>

            <div className='field'>
              <label htmlFor='password-reset-confirm'>Confirm password</label>
              <Input
                id='password-reset-confirm'
                type='password'
                autoComplete='new-password'
                minLength={8}
                maxLength={128}
                {...passwordResetForm.register('confirmPassword', {
                  required: 'Password confirmation is required.',
                })}
              />
              {passwordResetForm.formState.errors.confirmPassword ? (
                <p className='form-error'>{passwordResetForm.formState.errors.confirmPassword.message}</p>
              ) : null}
            </div>
          </div>

          {resetPassword.error ? <p className='form-error'>{(resetPassword.error as Error).message}</p> : null}
          {passwordResetSuccess ? <p className='muted' role='status'>{passwordResetSuccess}</p> : null}

          <div className='section-actions'>
            <Button disabled={resetPassword.isPending || isLoading || !data?.data.length} type='submit'>
              {resetPassword.isPending ? 'Updating...' : 'Set password'}
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
