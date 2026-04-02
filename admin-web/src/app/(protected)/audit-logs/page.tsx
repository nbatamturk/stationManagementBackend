'use client';

import { FormEvent, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RequireRole } from '@/components/auth/require-role';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StateCard } from '@/components/ui/state-card';
import { TableShell } from '@/components/ui/table-shell';
import { auditLogsClient } from '@/lib/api/audit-logs-client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime, formatEnumLabel, formatRelativeTime } from '@/lib/format';

type Filters = {
  entityType: string;
  entityId: string;
  actorUserId: string;
  action: string;
  createdFrom: string;
  createdTo: string;
  sortOrder: 'asc' | 'desc';
  page: number;
};

function toDateTimeInputValue(value: string) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 16);
}

function fromDateTimeInputValue(value: string) {
  return value ? new Date(value).toISOString() : '';
}

function readFilters(searchParams: URLSearchParams): Filters {
  return {
    entityType: searchParams.get('entityType') ?? '',
    entityId: searchParams.get('entityId') ?? '',
    actorUserId: searchParams.get('actorUserId') ?? '',
    action: searchParams.get('action') ?? '',
    createdFrom: toDateTimeInputValue(searchParams.get('createdFrom') ?? ''),
    createdTo: toDateTimeInputValue(searchParams.get('createdTo') ?? ''),
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') ?? 'desc',
    page: Number(searchParams.get('page') ?? '1'),
  };
}

export default function AuditLogsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [filters, setFilters] = useState<Filters>(() => readFilters(new URLSearchParams(searchParamsKey)));
  const { data, isLoading, error } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () =>
      auditLogsClient.list({
        ...filters,
        createdFrom: fromDateTimeInputValue(filters.createdFrom) || undefined,
        createdTo: fromDateTimeInputValue(filters.createdTo) || undefined,
        entityType: filters.entityType || undefined,
        entityId: filters.entityId || undefined,
        actorUserId: filters.actorUserId || undefined,
        action: filters.action || undefined,
        sortBy: 'createdAt',
        limit: 25,
      }),
    enabled: isAdmin,
  });

  useEffect(() => {
    setFilters(readFilters(new URLSearchParams(searchParamsKey)));
  }, [searchParamsKey]);

  const updateUrl = (next: Filters) => {
    const params = new URLSearchParams();
    if (next.entityType) params.set('entityType', next.entityType);
    if (next.entityId) params.set('entityId', next.entityId);
    if (next.actorUserId) params.set('actorUserId', next.actorUserId);
    if (next.action) params.set('action', next.action);
    if (next.createdFrom) params.set('createdFrom', fromDateTimeInputValue(next.createdFrom));
    if (next.createdTo) params.set('createdTo', fromDateTimeInputValue(next.createdTo));
    if (next.sortOrder !== 'desc') params.set('sortOrder', next.sortOrder);
    if (next.page > 1) params.set('page', String(next.page));
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateUrl({ ...filters, page: 1 });
  };

  return (
    <RequireRole roles={['admin']} title='Admin only' description='Audit logs are restricted to administrators.'>
      <div className='page-stack'>
        <PageHeader
          title='Audit logs'
          description='Readable operational history with structured filters, timestamps, and metadata previews.'
        />

        <form className='card page-stack' onSubmit={handleSubmit}>
          <div className='filters-grid audit-primary-filters'>
            <div className='field'>
              <label htmlFor='audit-entity-type'>Entity type</label>
              <Input
                id='audit-entity-type'
                value={filters.entityType}
                onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))}
                placeholder='station, user, station_import'
              />
            </div>
            <div className='field'>
              <label htmlFor='audit-entity-id'>Entity ID</label>
              <Input
                id='audit-entity-id'
                value={filters.entityId}
                onChange={(event) => setFilters((current) => ({ ...current, entityId: event.target.value }))}
                placeholder='UUID'
              />
            </div>
            <div className='field'>
              <label htmlFor='audit-actor-user-id'>Actor user ID</label>
              <Input
                id='audit-actor-user-id'
                value={filters.actorUserId}
                onChange={(event) => setFilters((current) => ({ ...current, actorUserId: event.target.value }))}
                placeholder='UUID'
              />
            </div>
            <div className='field'>
              <label htmlFor='audit-action'>Action</label>
              <Input
                id='audit-action'
                value={filters.action}
                onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value }))}
                placeholder='station.updated, user.created'
              />
            </div>
          </div>

          <div className='filters-grid audit-secondary-filters'>
            <div className='field'>
              <label htmlFor='audit-created-from'>Created from</label>
              <Input
                id='audit-created-from'
                type='datetime-local'
                value={filters.createdFrom}
                onChange={(event) => setFilters((current) => ({ ...current, createdFrom: event.target.value }))}
              />
            </div>
            <div className='field'>
              <label htmlFor='audit-created-to'>Created to</label>
              <Input
                id='audit-created-to'
                type='datetime-local'
                value={filters.createdTo}
                onChange={(event) => setFilters((current) => ({ ...current, createdTo: event.target.value }))}
              />
            </div>
            <div className='field audit-sort-field'>
              <label htmlFor='audit-sort-order'>Sort order</label>
              <Select
                id='audit-sort-order'
                value={filters.sortOrder}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  sortOrder: event.target.value as 'asc' | 'desc',
                }))}
              >
                <option value='desc'>Newest first</option>
                <option value='asc'>Oldest first</option>
              </Select>
            </div>
          </div>

          <div className='section-actions'>
            <Button type='submit'>Apply filters</Button>
            <Button
              type='button'
              variant='secondary'
              onClick={() => {
                const next = {
                  entityType: '',
                  entityId: '',
                  actorUserId: '',
                  action: '',
                  createdFrom: '',
                  createdTo: '',
                  sortOrder: 'desc' as const,
                  page: 1,
                };
                setFilters(next);
                updateUrl(next);
              }}
            >
              Reset
            </Button>
          </div>
        </form>

        {isLoading ? (
          <StateCard title='Loading audit logs' description='Fetching the latest audit trail from the backend.' />
        ) : null}

        {error ? (
          <StateCard title='Audit logs unavailable' description={(error as Error).message} tone='danger' />
        ) : null}

        {!isLoading && !error ? (
          <TableShell
            title='Audit trail'
            description='Normalized, timestamped backend actions with expandable metadata.'
          >
            {data?.data.length ? (
              <>
                <div className='table-wrap'>
                  <table className='table'>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Entity</th>
                        <th>Action</th>
                        <th>Actor</th>
                        <th>Metadata</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((record) => (
                        <tr key={record.id}>
                          <td>
                            <div className='list'>
                              <strong>{formatRelativeTime(record.createdAt)}</strong>
                              <span className='muted'>{formatDateTime(record.createdAt)}</span>
                            </div>
                          </td>
                          <td>
                            <div className='list'>
                              <Badge>{record.entityType}</Badge>
                              <span className='muted'>{record.entityId}</span>
                            </div>
                          </td>
                          <td>
                            <Badge tone='info'>{formatEnumLabel(record.action)}</Badge>
                          </td>
                          <td>{record.actorUserId ?? 'system'}</td>
                          <td>
                            <details className='details-panel'>
                              <summary>View metadata</summary>
                              <pre>{JSON.stringify(record.metadata, null, 2)}</pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className='pagination'>
                  <p className='pagination-info'>
                    Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} total records
                  </p>
                  <div className='inline-cluster'>
                    <Button
                      variant='secondary'
                      onClick={() => updateUrl({ ...filters, page: Math.max(1, filters.page - 1) })}
                      disabled={filters.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant='secondary'
                      onClick={() => updateUrl({ ...filters, page: filters.page + 1 })}
                      disabled={filters.page >= data.meta.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <p className='table-empty'>No audit log records match the current filter set.</p>
            )}
          </TableShell>
        ) : null}
      </div>
    </RequireRole>
  );
}
