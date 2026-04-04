'use client';

import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { RequireRole } from '@/components/auth/require-role';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { StateCard } from '@/components/ui/state-card';
import { mobileAppConfigClient } from '@/lib/api/mobile-app-config-client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime } from '@/lib/format';
import { useDocumentTitle } from '@/lib/use-document-title';
import { MobileAppConfig } from '@/types/api';

type MobileAppConfigFormValues = {
  iosMinimumSupportedVersion: string;
  androidMinimumSupportedVersion: string;
  iosDownloadUrl: string;
  androidDownloadUrl: string;
};

const defaultFormValues: MobileAppConfigFormValues = {
  iosMinimumSupportedVersion: '',
  androidMinimumSupportedVersion: '',
  iosDownloadUrl: '',
  androidDownloadUrl: '',
};

const versionPattern = /^\d+\.\d+\.\d+$/;

const toFormValues = (config: MobileAppConfig): MobileAppConfigFormValues => ({
  iosMinimumSupportedVersion: config.iosMinimumSupportedVersion ?? '',
  androidMinimumSupportedVersion: config.androidMinimumSupportedVersion ?? '',
  iosDownloadUrl: config.iosDownloadUrl ?? '',
  androidDownloadUrl: config.androidDownloadUrl ?? '',
});

const toNullableVersion = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const toNullableUrl = (value: string) => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const validateOptionalVersion = (value: string) => {
  const normalized = value.trim();

  if (!normalized) {
    return true;
  }

  return versionPattern.test(normalized) || 'Use x.y.z format.';
};

const validateOptionalHttpsUrl = (value: string) => {
  const normalized = value.trim();

  if (!normalized) {
    return true;
  }

  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'https:' || 'Use an https:// URL.';
  } catch {
    return 'Use a valid https:// URL.';
  }
};

export default function MobileAppConfigPage() {
  useDocumentTitle('Mobile App Config');
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const form = useForm<MobileAppConfigFormValues>({
    defaultValues: defaultFormValues,
  });

  const configQuery = useQuery({
    queryKey: ['mobileAppConfig'],
    queryFn: () => mobileAppConfigClient.get(),
    enabled: isAdmin,
  });

  useEffect(() => {
    if (configQuery.data?.data) {
      form.reset(toFormValues(configQuery.data.data));
    }
  }, [configQuery.data?.data, form]);

  const saveConfig = useMutation({
    mutationFn: (values: MobileAppConfigFormValues) =>
      mobileAppConfigClient.update({
        iosMinimumSupportedVersion: toNullableVersion(values.iosMinimumSupportedVersion),
        androidMinimumSupportedVersion: toNullableVersion(values.androidMinimumSupportedVersion),
        iosDownloadUrl: toNullableUrl(values.iosDownloadUrl),
        androidDownloadUrl: toNullableUrl(values.androidDownloadUrl),
      }),
    onSuccess: async (response) => {
      form.reset(toFormValues(response.data));
      await queryClient.invalidateQueries({ queryKey: ['mobileAppConfig'] });
    },
  });

  const currentConfig = configQuery.data?.data ?? null;

  return (
    <RequireRole
      roles={['admin']}
      title='Admin only'
      description='Mobile app version policy management is restricted to administrators.'
    >
      <div className='page-stack'>
        <PageHeader
          title='Mobile app config'
          description='Manage the minimum supported iOS and Android app versions plus optional store download links used by mobile warning flows.'
        />

        <StateCard
          title='Warning-only policy'
          description='Minimum supported versions stay non-blocking. When a warning appears on mobile, the optional platform download URLs below will power the Update App button.'
          tone='warning'
        />

        {configQuery.isLoading ? (
          <StateCard title='Loading mobile app config' description='Fetching the current version policy from the backend.' />
        ) : null}

        {configQuery.error ? (
          <StateCard
            title='Mobile app config unavailable'
            description={(configQuery.error as Error).message}
            tone='danger'
          />
        ) : null}

        <form
          className='card page-stack'
          onSubmit={form.handleSubmit(async (values) => {
            await saveConfig.mutateAsync(values);
          })}
        >
          <div>
            <h3>Platform version policy</h3>
            <p className='muted'>
              {currentConfig?.updatedAt
                ? `Last updated ${formatDateTime(currentConfig.updatedAt)}${currentConfig.updatedByUserId ? ` by ${currentConfig.updatedByUserId}` : ''}.`
                : 'No mobile app version policy has been saved yet.'}
            </p>
          </div>

          <div className='form-grid'>
            <div className='field'>
              <label htmlFor='ios-min-version'>iOS minimum supported version</label>
              <Input
                id='ios-min-version'
                placeholder='1.0.0'
                {...form.register('iosMinimumSupportedVersion', {
                  validate: validateOptionalVersion,
                })}
              />
              <p className='muted'>Leave blank to disable warning checks for iOS.</p>
              {form.formState.errors.iosMinimumSupportedVersion ? (
                <p className='form-error'>{form.formState.errors.iosMinimumSupportedVersion.message}</p>
              ) : null}
            </div>

            <div className='field'>
              <label htmlFor='ios-download-url'>iOS download URL</label>
              <Input
                id='ios-download-url'
                placeholder='https://apps.apple.com/app/...'
                {...form.register('iosDownloadUrl', {
                  validate: validateOptionalHttpsUrl,
                })}
              />
              <p className='muted'>Optional. Used by the mobile warning modal Update App button for iOS.</p>
              {currentConfig?.iosDownloadUrl ? (
                <a href={currentConfig.iosDownloadUrl} target='_blank' rel='noreferrer' className='pill-link'>
                  Open current iOS link
                </a>
              ) : null}
              {form.formState.errors.iosDownloadUrl ? (
                <p className='form-error'>{form.formState.errors.iosDownloadUrl.message}</p>
              ) : null}
            </div>

            <div className='field'>
              <label htmlFor='android-min-version'>Android minimum supported version</label>
              <Input
                id='android-min-version'
                placeholder='1.0.0'
                {...form.register('androidMinimumSupportedVersion', {
                  validate: validateOptionalVersion,
                })}
              />
              <p className='muted'>Leave blank to disable warning checks for Android.</p>
              {form.formState.errors.androidMinimumSupportedVersion ? (
                <p className='form-error'>{form.formState.errors.androidMinimumSupportedVersion.message}</p>
              ) : null}
            </div>

            <div className='field'>
              <label htmlFor='android-download-url'>Android download URL</label>
              <Input
                id='android-download-url'
                placeholder='https://play.google.com/store/apps/details?id=...'
                {...form.register('androidDownloadUrl', {
                  validate: validateOptionalHttpsUrl,
                })}
              />
              <p className='muted'>Optional. Used by the mobile warning modal Update App button for Android.</p>
              {currentConfig?.androidDownloadUrl ? (
                <a href={currentConfig.androidDownloadUrl} target='_blank' rel='noreferrer' className='pill-link'>
                  Open current Android link
                </a>
              ) : null}
              {form.formState.errors.androidDownloadUrl ? (
                <p className='form-error'>{form.formState.errors.androidDownloadUrl.message}</p>
              ) : null}
            </div>
          </div>

          {saveConfig.error ? <p className='form-error'>{(saveConfig.error as Error).message}</p> : null}

          <div className='section-actions'>
            <Button type='submit' disabled={saveConfig.isPending || configQuery.isLoading}>
              {saveConfig.isPending ? 'Saving...' : 'Save mobile app policy'}
            </Button>
          </div>
        </form>
      </div>
    </RequireRole>
  );
}
