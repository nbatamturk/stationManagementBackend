'use client';

import { useRef, useState } from 'react';
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
import { usersClient } from '@/lib/api/users-client';
import { useAuth } from '@/lib/auth/auth-context';
import { useDocumentTitle } from '@/lib/use-document-title';

type UserRoleValue = 'admin' | 'operator' | 'viewer';

type UserFormValues = {
  email: string;
  fullName: string;
  password: string;
  role: UserRoleValue;
  isActive: 'true' | 'false';
};

const defaultUserFormValues: UserFormValues = {
  email: '',
  fullName: '',
  password: '',
  role: 'viewer',
  isActive: 'true',
};

const focusForm = (form: HTMLFormElement | null, fieldId: string) => {
  form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  window.requestAnimationFrame(() => {
    const field = document.getElementById(fieldId) as HTMLInputElement | HTMLSelectElement | null;
    field?.focus();
  });
};

export default function UsersPage() {
  useDocumentTitle('Users');
  const { isAdmin, user: currentUser } = useAuth();
  const qc = useQueryClient();
  const userFormRef = useRef<HTMLFormElement | null>(null);
  const [editingUserId, setEditingUserId] = useState('');
  const [passwordResetSuccess, setPasswordResetSuccess] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersClient.list({ page: 1, limit: 50 }),
    enabled: isAdmin,
  });
  const users = data?.data ?? [];
  const form = useForm<UserFormValues>({
    defaultValues: defaultUserFormValues,
  });
  const passwordResetForm = useForm({
    defaultValues: { userId: '', password: '', confirmPassword: '' },
  });

  const resetUserForm = () => {
    setEditingUserId('');
    form.reset(defaultUserFormValues);
  };

  const startEdit = (targetUser: {
    id: string;
    email: string;
    fullName: string;
    role: UserRoleValue;
    isActive: boolean;
  }) => {
    setEditingUserId(targetUser.id);
    form.reset({
      email: targetUser.email,
      fullName: targetUser.fullName,
      password: '',
      role: targetUser.role,
      isActive: String(targetUser.isActive) as 'true' | 'false',
    });
    focusForm(userFormRef.current, 'user-email');
  };

  const saveUser = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (editingUserId) {
        const targetUser = users.find((candidate) => candidate.id === editingUserId);
        const nextIsActive = values.isActive === 'true';

        const response = await usersClient.update(editingUserId, {
          email: values.email,
          fullName: values.fullName,
          role: values.role,
        });

        if (targetUser && targetUser.isActive !== nextIsActive) {
          await usersClient.setActive(editingUserId, nextIsActive);
        }

        return response;
      }

      return usersClient.create({
        email: values.email,
        fullName: values.fullName,
        password: values.password,
        role: values.role,
        isActive: values.isActive === 'true',
      });
    },
    onSuccess: async () => {
      resetUserForm();
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => usersClient.setActive(id, isActive),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => usersClient.remove(id),
    onSuccess: async (_response, id) => {
      if (editingUserId === id) {
        resetUserForm();
      }

      await qc.invalidateQueries({ queryKey: ['users'] });
    },
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
        <PageHeader title='Users' description='Manage internal access without leaving the operations panel.' />

        <form
          ref={userFormRef}
          className='card page-stack'
          onSubmit={form.handleSubmit(async (values) => {
            await saveUser.mutateAsync(values);
          })}
        >
          <div className='stack-row' style={{ justifyContent: 'space-between' }}>
            <div>
              <h3>{editingUserId ? 'Edit user' : 'Create user'}</h3>
              <p className='muted'>Provision new internal accounts or update existing user details and role access.</p>
            </div>
            {editingUserId ? (
              <Button type='button' variant='ghost' onClick={resetUserForm}>
                Cancel edit
              </Button>
            ) : null}
          </div>
          <div className='form-grid'>
            <div className='field'>
              <label htmlFor='user-email'>Email</label>
              <Input
                id='user-email'
                type='email'
                {...form.register('email', {
                  required: 'Email is required.',
                })}
              />
              {form.formState.errors.email ? <p className='form-error'>{form.formState.errors.email.message}</p> : null}
            </div>
            <div className='field'>
              <label htmlFor='user-full-name'>Full name</label>
              <Input
                id='user-full-name'
                {...form.register('fullName', {
                  required: 'Full name is required.',
                })}
              />
              {form.formState.errors.fullName ? <p className='form-error'>{form.formState.errors.fullName.message}</p> : null}
            </div>
            {!editingUserId ? (
              <div className='field'>
                <label htmlFor='user-password'>Password</label>
                <Input
                  id='user-password'
                  type='password'
                  autoComplete='new-password'
                  minLength={8}
                  maxLength={128}
                  {...form.register('password', {
                    required: 'Password is required for new users.',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters.',
                    },
                  })}
                />
                {form.formState.errors.password ? <p className='form-error'>{form.formState.errors.password.message}</p> : null}
              </div>
            ) : null}
            <div className='field'>
              <label htmlFor='user-role'>Role</label>
              <Select id='user-role' {...form.register('role')}>
                <option value='admin'>admin</option>
                <option value='operator'>operator</option>
                <option value='viewer'>viewer</option>
              </Select>
            </div>
            <div className='field'>
              <label htmlFor='user-active'>State</label>
              <Select id='user-active' {...form.register('isActive')}>
                <option value='true'>Active</option>
                <option value='false'>Inactive</option>
              </Select>
            </div>
          </div>
          {saveUser.error ? <p className='form-error'>{(saveUser.error as Error).message}</p> : null}
          <div className='section-actions'>
            <Button disabled={saveUser.isPending} type='submit'>
              {saveUser.isPending ? 'Saving...' : editingUserId ? 'Save user' : 'Create user'}
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
                {users.map((targetUser) => (
                  <option key={targetUser.id} value={targetUser.id}>
                    {targetUser.fullName} ({targetUser.email})
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
            <Button disabled={resetPassword.isPending || isLoading || users.length === 0} type='submit'>
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
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((targetUser) => {
                    const isCurrentUser = currentUser?.id === targetUser.id;

                    return (
                      <tr key={targetUser.id}>
                        <td>
                          <div className='list'>
                            <strong>{targetUser.fullName}</strong>
                            {isCurrentUser ? <span className='muted'>Current session</span> : null}
                          </div>
                        </td>
                        <td>{targetUser.email}</td>
                        <td><Badge tone='info'>{targetUser.role}</Badge></td>
                        <td><Badge tone={targetUser.isActive ? 'success' : 'warning'}>{targetUser.isActive ? 'Active' : 'Inactive'}</Badge></td>
                        <td>
                          <div className='table-actions'>
                            <Button type='button' variant='secondary' onClick={() => startEdit(targetUser)}>
                              Edit
                            </Button>
                            <Button
                              type='button'
                              variant='ghost'
                              onClick={() => toggle.mutate({ id: targetUser.id, isActive: !targetUser.isActive })}
                              disabled={toggle.isPending}
                            >
                              {targetUser.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <ConfirmButton
                              label='Delete'
                              variant='danger'
                              disabled={remove.isPending || isCurrentUser}
                              confirmText={`Delete user "${targetUser.fullName}"? This cannot be undone.`}
                              onConfirm={() => {
                                remove.mutate(targetUser.id);
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
