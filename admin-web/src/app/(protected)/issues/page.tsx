'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { issuesClient } from '@/lib/api/issues-client';
import { stationsClient } from '@/lib/api/stations-client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime, formatEnumLabel } from '@/lib/format';
import { IssueSeverity } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { StationPicker } from '@/features/stations/station-picker';
import { useDocumentTitle } from '@/lib/use-document-title';

type Filters = {
  stationId: string;
  status: string;
  severity: string;
};

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

function readFilters(searchParams: URLSearchParams): Filters {
  return {
    stationId: searchParams.get('stationId') ?? '',
    status: searchParams.get('status') ?? '',
    severity: searchParams.get('severity') ?? '',
  };
}

export default function IssuesOverviewPage() {
  const { canWrite } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [filters, setFilters] = useState<Filters>(() => readFilters(new URLSearchParams(searchParamsKey)));

  const station = useQuery({
    queryKey: ['issues-station', filters.stationId],
    queryFn: () => stationsClient.get(filters.stationId),
    enabled: Boolean(filters.stationId),
  });
  const issues = useQuery({
    queryKey: ['issues-page', filters.stationId],
    queryFn: () => issuesClient.listByStation(filters.stationId),
    enabled: Boolean(filters.stationId),
  });
  const createForm = useForm<{ title: string; severity: IssueSeverity; description: string }>({
    defaultValues: {
      title: '',
      severity: 'medium',
      description: '',
    },
  });
  const createIssue = useMutation({
    mutationFn: (payload: { title: string; severity: IssueSeverity; description?: string }) =>
      issuesClient.create(filters.stationId, payload),
    onSuccess: async () => {
      createForm.reset({ title: '', severity: 'medium', description: '' });
      await queryClient.invalidateQueries({ queryKey: ['issues-page', filters.stationId] });
      await queryClient.invalidateQueries({ queryKey: ['station', filters.stationId] });
    },
  });

  useEffect(() => {
    setFilters(readFilters(new URLSearchParams(searchParamsKey)));
  }, [searchParamsKey]);

  const updateUrl = (next: Filters) => {
    const params = new URLSearchParams();
    if (next.stationId) params.set('stationId', next.stationId);
    if (next.status) params.set('status', next.status);
    if (next.severity) params.set('severity', next.severity);
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const filteredIssues = (issues.data?.data ?? []).filter((issue) => {
    if (filters.status && issue.status !== filters.status) {
      return false;
    }

    if (filters.severity && issue.severity !== filters.severity) {
      return false;
    }

    return true;
  });

  const openCount = filteredIssues.filter((issue) => issue.status === 'open' || issue.status === 'in_progress').length;
  const criticalCount = filteredIssues.filter((issue) => issue.severity === 'critical').length;
  useDocumentTitle(station.data?.data ? `Issues - ${station.data.data.code}` : 'Issues');

  return (
    <div className='page-stack'>
      <PageHeader
        title='Issues'
        description='A station-connected issue inbox that keeps issue review close to the operational context.'
      />

      <div className='card page-stack'>
        <div className='toolbar'>
          <StationPicker
            value={filters.stationId}
            onChange={(stationId) => {
              const next = { ...filters, stationId };
              setFilters(next);
              updateUrl(next);
            }}
          />
          <div className='field'>
            <label htmlFor='issue-status-filter'>Status</label>
            <Select
              id='issue-status-filter'
              value={filters.status}
              onChange={(event) => {
                const next = { ...filters, status: event.target.value };
                setFilters(next);
                updateUrl(next);
              }}
            >
              <option value=''>All statuses</option>
              <option value='open'>Open</option>
              <option value='in_progress'>In progress</option>
              <option value='resolved'>Resolved</option>
              <option value='closed'>Closed</option>
            </Select>
          </div>
          <div className='field'>
            <label htmlFor='issue-severity-filter'>Severity</label>
            <Select
              id='issue-severity-filter'
              value={filters.severity}
              onChange={(event) => {
                const next = { ...filters, severity: event.target.value };
                setFilters(next);
                updateUrl(next);
              }}
            >
              <option value=''>All severities</option>
              <option value='low'>Low</option>
              <option value='medium'>Medium</option>
              <option value='high'>High</option>
              <option value='critical'>Critical</option>
            </Select>
          </div>
          <div className='field'>
            <label>&nbsp;</label>
            <Button
              type='button'
              variant='secondary'
              onClick={() => {
                const next = { stationId: '', status: '', severity: '' };
                setFilters(next);
                updateUrl(next);
              }}
            >
              Reset filters
            </Button>
          </div>
        </div>

        {station.data?.data ? (
          <div className='summary-grid'>
            <div className='card metric-card'>
              <p className='eyebrow'>Selected station</p>
              <strong>{station.data.data.name}</strong>
              <p className='muted'>{station.data.data.code} · {station.data.data.location}</p>
            </div>
            <div className='card metric-card'>
              <p className='eyebrow'>Visible issues</p>
              <p className='kpi-value'>{filteredIssues.length}</p>
              <p className='muted'>Records that match the current filters.</p>
            </div>
            <div className='card metric-card'>
              <p className='eyebrow'>Open / in progress</p>
              <p className='kpi-value'>{openCount}</p>
              <p className='muted'>Items still requiring follow-up.</p>
            </div>
            <div className='card metric-card'>
              <p className='eyebrow'>Critical</p>
              <p className='kpi-value'>{criticalCount}</p>
              <p className='muted'>Highest priority issues in the current set.</p>
            </div>
          </div>
        ) : null}
      </div>

      {!filters.stationId ? (
        <StateCard title='Choose a station' description='Issue records are station-scoped today, so start by selecting a station.' />
      ) : null}

      {filters.stationId && canWrite ? (
        <form
          className='card page-stack'
          onSubmit={createForm.handleSubmit(async (values) => {
            await createIssue.mutateAsync({
              title: values.title,
              severity: values.severity,
              description: values.description.trim() || undefined,
            });
          })}
        >
          <div>
            <h3>Create issue</h3>
            <p className='muted'>Add a new issue without leaving the station workflow.</p>
          </div>
          <div className='form-grid'>
            <div className='field'>
              <label htmlFor='issue-title'>Title</label>
              <Input id='issue-title' {...createForm.register('title', { required: true })} />
            </div>
            <div className='field'>
              <label htmlFor='issue-severity'>Severity</label>
              <Select id='issue-severity' {...createForm.register('severity')}>
                <option value='low'>Low</option>
                <option value='medium'>Medium</option>
                <option value='high'>High</option>
                <option value='critical'>Critical</option>
              </Select>
            </div>
          </div>
          <div className='field'>
            <label htmlFor='issue-description'>Description</label>
            <Textarea id='issue-description' {...createForm.register('description')} />
          </div>
          {createIssue.error ? <p className='form-error'>{(createIssue.error as Error).message}</p> : null}
          <div className='section-actions'>
            <Button disabled={createIssue.isPending} type='submit'>
              {createIssue.isPending ? 'Creating...' : 'Create issue'}
            </Button>
          </div>
        </form>
      ) : null}

      {filters.stationId && issues.isLoading ? (
        <StateCard title='Loading issues' description='Fetching the issue list for the selected station.' />
      ) : null}

      {filters.stationId && issues.error ? (
        <StateCard title='Issues unavailable' description={(issues.error as Error).message} tone='danger' />
      ) : null}

      {filters.stationId && !issues.isLoading && !issues.error ? (
        <div className='card list'>
          <div>
            <h3>Issue list</h3>
            <p className='muted'>Open each issue to update status, severity, or title with full station context.</p>
          </div>
          {filteredIssues.length === 0 ? (
            <p className='muted'>No issues match the current filters.</p>
          ) : (
            filteredIssues.map((issue) => (
              <Link key={issue.id} href={`/issues/${issue.id}`} className='list-item'>
                <div className='stack-row' style={{ justifyContent: 'space-between' }}>
                  <div>
                    <strong>{issue.title}</strong>
                    <p className='muted'>{formatDateTime(issue.createdAt)}</p>
                  </div>
                  <div className='inline-cluster'>
                    <Badge tone={getTone(issue.severity)}>{formatEnumLabel(issue.severity)}</Badge>
                    <Badge tone={getTone(issue.status)}>{formatEnumLabel(issue.status)}</Badge>
                  </div>
                </div>
                <p>{issue.description || 'No description provided.'}</p>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
