'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { issuesClient } from '@/lib/api/issues-client';
import { stationsClient } from '@/lib/api/stations-client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime, formatEnumLabel } from '@/lib/format';
import { IssueSeverity, IssueStatus } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';
import { Textarea } from '@/components/ui/textarea';

function getTone(value: string) {
  if (value === 'resolved' || value === 'closed') {
    return 'success';
  }

  if (value === 'in_progress' || value === 'medium') {
    return 'warning';
  }

  if (value === 'critical' || value === 'open' || value === 'high') {
    return 'danger';
  }

  return 'neutral';
}

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canWrite } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const issue = useQuery({ queryKey: ['issue-detail', id], queryFn: () => issuesClient.get(id) });
  const station = useQuery({
    queryKey: ['issue-station', issue.data?.data.stationId],
    queryFn: () => stationsClient.get(issue.data!.data.stationId),
    enabled: Boolean(issue.data?.data.stationId),
  });
  const form = useForm<{ title: string; description: string; severity: IssueSeverity; status: IssueStatus }>({
    defaultValues: {
      title: '',
      description: '',
      severity: 'medium',
      status: 'open',
    },
  });

  useEffect(() => {
    if (issue.data?.data) {
      form.reset({
        title: issue.data.data.title,
        description: issue.data.data.description ?? '',
        severity: issue.data.data.severity,
        status: issue.data.data.status,
      });
    }
  }, [form, issue.data]);

  const updateIssue = useMutation({
    mutationFn: (payload: { title: string; description: string | null; severity: IssueSeverity; status: IssueStatus }) =>
      issuesClient.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['issue-detail', id] });
      await queryClient.invalidateQueries({ queryKey: ['issues-page'] });
      await queryClient.invalidateQueries({ queryKey: ['station-issues'] });
    },
  });
  const deleteIssue = useMutation({
    mutationFn: () => issuesClient.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['issues-page'] });
      router.push(issue.data?.data.stationId ? `/issues?stationId=${issue.data.data.stationId}` : '/issues');
    },
  });

  if (issue.isLoading) {
    return <StateCard title='Loading issue' description='Fetching issue details and related station context.' />;
  }

  if (!issue.data) {
    return <StateCard title='Issue not found' description='The requested issue could not be loaded.' tone='warning' />;
  }

  const currentIssue = issue.data.data;

  return (
    <div className='page-stack'>
      <PageHeader
        title={currentIssue.title}
        description='Review status, severity, and station context without losing the operational thread.'
        actions={
          station.data?.data ? (
            <div className='page-header-actions'>
              <Link href={`/stations/${station.data.data.id}`} className='pill-link'>Open station</Link>
              <Link href={`/issues?stationId=${station.data.data.id}`} className='pill-link'>Back to issue list</Link>
            </div>
          ) : undefined
        }
      />

      <div className='summary-grid'>
        <div className='card metric-card'>
          <p className='eyebrow'>Severity</p>
          <Badge tone={getTone(currentIssue.severity)}>{formatEnumLabel(currentIssue.severity)}</Badge>
          <p className='muted'>Priority level assigned to this issue.</p>
        </div>
        <div className='card metric-card'>
          <p className='eyebrow'>Status</p>
          <Badge tone={getTone(currentIssue.status)}>{formatEnumLabel(currentIssue.status)}</Badge>
          <p className='muted'>Current progress state for the issue lifecycle.</p>
        </div>
        <div className='card metric-card'>
          <p className='eyebrow'>Created</p>
          <strong>{formatDateTime(currentIssue.createdAt)}</strong>
          <p className='muted'>Originally logged by the backend issue workflow.</p>
        </div>
        <div className='card metric-card'>
          <p className='eyebrow'>Resolved at</p>
          <strong>{currentIssue.resolvedAt ? formatDateTime(currentIssue.resolvedAt) : 'Not resolved'}</strong>
          <p className='muted'>Resolution timestamp if the issue has been completed.</p>
        </div>
      </div>

      {station.data?.data ? (
        <div className='card meta-list'>
          <div>
            <h3>Station context</h3>
            <p className='muted'>Keep the issue connected to the station that triggered it.</p>
          </div>
          <div className='meta-row'><span className='meta-label'>Station</span><span>{station.data.data.name}</span></div>
          <div className='meta-row'><span className='meta-label'>Code</span><span>{station.data.data.code}</span></div>
          <div className='meta-row'><span className='meta-label'>Location</span><span>{station.data.data.location}</span></div>
          <div className='meta-row'><span className='meta-label'>Status</span><span>{formatEnumLabel(station.data.data.status)}</span></div>
        </div>
      ) : null}

      <div className='card page-stack'>
        <div>
          <h3>{canWrite ? 'Update issue' : 'Issue details'}</h3>
          <p className='muted'>
            {canWrite
              ? 'Adjust title, severity, description, and status using the current backend issue contract.'
              : 'Viewer access is read-only. Use this page to review context and current status.'}
          </p>
        </div>

        <div className='form-grid'>
          <div className='field'>
            <label htmlFor='issue-title'>Title</label>
            <Input id='issue-title' disabled={!canWrite} {...form.register('title')} />
          </div>
          <div className='field'>
            <label htmlFor='issue-severity'>Severity</label>
            <Select id='issue-severity' disabled={!canWrite} {...form.register('severity')}>
              <option value='low'>Low</option>
              <option value='medium'>Medium</option>
              <option value='high'>High</option>
              <option value='critical'>Critical</option>
            </Select>
          </div>
          <div className='field'>
            <label htmlFor='issue-status'>Status</label>
            <Select id='issue-status' disabled={!canWrite} {...form.register('status')}>
              <option value='open'>Open</option>
              <option value='in_progress'>In progress</option>
              <option value='resolved'>Resolved</option>
              <option value='closed'>Closed</option>
            </Select>
          </div>
        </div>

        <div className='field'>
          <label htmlFor='issue-description'>Description</label>
          <Textarea id='issue-description' disabled={!canWrite} {...form.register('description')} />
        </div>

        {updateIssue.error ? <p className='form-error'>{(updateIssue.error as Error).message}</p> : null}

        {canWrite ? (
          <div className='section-actions'>
            <Button
              disabled={updateIssue.isPending}
              onClick={form.handleSubmit(async (values) => {
                await updateIssue.mutateAsync({
                  title: values.title,
                  description: values.description.trim() || null,
                  severity: values.severity,
                  status: values.status,
                });
              })}
              type='button'
            >
              {updateIssue.isPending ? 'Saving...' : 'Save issue'}
            </Button>
            <ConfirmButton
              label='Delete issue'
              confirmText='Delete this issue?'
              onConfirm={() => deleteIssue.mutate()}
              variant='danger'
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
