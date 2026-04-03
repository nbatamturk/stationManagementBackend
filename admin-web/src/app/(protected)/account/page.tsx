'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/api/auth-client';
import { useAuth } from '@/lib/auth/auth-context';
import { useDocumentTitle } from '@/lib/use-document-title';

type AccountPasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function AccountPage() {
  useDocumentTitle('Account');
  const { user } = useAuth();
  const [successMessage, setSuccessMessage] = useState('');
  const form = useForm<AccountPasswordFormValues>({
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const mutation = useMutation({
    mutationFn: authClient.changePassword,
    onSuccess: () => {
      form.reset({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setSuccessMessage('Password updated successfully.');
    },
  });

  return (
    <div className='page-stack'>
      <PageHeader
        title='Account'
        description='Update the password for the signed-in account without ending the current session.'
      />

      <div className='card page-stack'>
        <div>
          <h3>{user?.fullName ?? 'Signed-in user'}</h3>
          <p className='muted'>{user?.email ?? '-'}</p>
        </div>
        <p className='muted'>Role: {user?.role ?? '-'}</p>
      </div>

      <form
        className='card page-stack'
        onSubmit={form.handleSubmit(async (values) => {
          setSuccessMessage('');

          if (values.newPassword !== values.confirmPassword) {
            form.setError('confirmPassword', {
              type: 'validate',
              message: 'New password confirmation does not match.',
            });
            return;
          }

          form.clearErrors('confirmPassword');

          await mutation.mutateAsync({
            currentPassword: values.currentPassword,
            newPassword: values.newPassword,
          });
        })}
      >
        <div>
          <h3>Change password</h3>
          <p className='muted'>Use your current password to confirm the update.</p>
        </div>

        <div className='form-grid'>
          <div className='field'>
            <label htmlFor='account-current-password'>Current password</label>
            <Input
              id='account-current-password'
              type='password'
              autoComplete='current-password'
              minLength={1}
              maxLength={128}
              {...form.register('currentPassword', {
                required: 'Current password is required.',
              })}
            />
            {form.formState.errors.currentPassword ? (
              <p className='form-error'>{form.formState.errors.currentPassword.message}</p>
            ) : null}
          </div>

          <div className='field'>
            <label htmlFor='account-new-password'>New password</label>
            <Input
              id='account-new-password'
              type='password'
              autoComplete='new-password'
              minLength={8}
              maxLength={128}
              {...form.register('newPassword', {
                required: 'New password is required.',
                minLength: {
                  value: 8,
                  message: 'New password must be at least 8 characters.',
                },
              })}
            />
            {form.formState.errors.newPassword ? (
              <p className='form-error'>{form.formState.errors.newPassword.message}</p>
            ) : null}
          </div>

          <div className='field'>
            <label htmlFor='account-confirm-password'>Confirm new password</label>
            <Input
              id='account-confirm-password'
              type='password'
              autoComplete='new-password'
              minLength={8}
              maxLength={128}
              {...form.register('confirmPassword', {
                required: 'Password confirmation is required.',
              })}
            />
            {form.formState.errors.confirmPassword ? (
              <p className='form-error'>{form.formState.errors.confirmPassword.message}</p>
            ) : null}
          </div>
        </div>

        {mutation.error ? <p className='form-error'>{(mutation.error as Error).message}</p> : null}
        {successMessage ? <p className='muted' role='status'>{successMessage}</p> : null}

        <div className='section-actions'>
          <Button disabled={mutation.isPending} type='submit'>
            {mutation.isPending ? 'Updating...' : 'Update password'}
          </Button>
        </div>
      </form>
    </div>
  );
}
