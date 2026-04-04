'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stationsClient } from '@/lib/api/stations-client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatCustomValue, formatDateTime, formatEnumLabel, formatRelativeTime } from '@/lib/format';
import { CustomField } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { StateCard } from '@/components/ui/state-card';
import { TableShell } from '@/components/ui/table-shell';
import {
  formatConnectorCount,
  formatPowerKw,
  getConnectorCurrentMixLabel,
  getConnectorTypesLabel,
} from './connector-form';

type QueryValue = string | number | boolean | undefined;

function getStatusTone(status: string) {
  if (status === 'active' || status === 'pass') {
    return 'success';
  }

  if (status === 'maintenance' || status === 'warning') {
    return 'warning';
  }

  if (status === 'faulty' || status === 'fail') {
    return 'danger';
  }

  return 'neutral';
}

export function StationsTable({
  query,
  visibleFields,
  hasActiveFilters,
  onPageChange,
}: {
  query: Record<string, QueryValue>;
  visibleFields: CustomField[];
  hasActiveFilters: boolean;
  onPageChange: (page: number) => void;
}) {
  const { canWrite, isAdmin } = useAuth();
  const qc = useQueryClient();
  const page = Number(query.page ?? 1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['stations-table', query],
    queryFn: () => stationsClient.list(query),
  });

  const archive = useMutation({
    mutationFn: (id: string) => stationsClient.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stations-table'] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => stationsClient.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stations-table'] }),
  });

  if (isLoading) {
    return <StateCard title='Loading stations' description='Pulling the latest station list and summary counts.' />;
  }

  if (error) {
    return (
      <StateCard
        title='Stations unavailable'
        description={(error as Error).message || 'The station list could not be loaded.'}
        tone='danger'
      />
    );
  }

  const rows = data?.data ?? [];
  const meta = data?.meta;
  const start = meta ? (meta.page - 1) * meta.limit + 1 : 0;
  const end = meta ? Math.min(meta.page * meta.limit, meta.total) : 0;

  return (
    <TableShell
      title='Station inventory'
      description='Search, sort, and act on the current fleet without leaving the table.'
      actions={
        canWrite ? (
          <Link href='/stations/new' className='pill-link'>Create station</Link>
        ) : undefined
      }
    >
      {rows.length === 0 ? (
        <p className='table-empty'>
          {hasActiveFilters
            ? 'No stations match the current filters. Try broadening the search or clearing one of the connector-related filters.'
            : 'No stations have been created yet. Create the first station to start managing the fleet here.'}
        </p>
      ) : (
        <>
          <div className='table-wrap'>
            <table className='table'>
              <thead>
                <tr>
                  <th>Station</th>
                  <th>Health</th>
                  <th>Location</th>
                  {visibleFields.map((field) => <th key={field.id}>{field.label}</th>)}
                  <th>Latest activity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((station) => (
                  <tr key={station.id}>
                    <td>
                      <div className='list'>
                        <div>
                          <strong>{station.name}</strong>
                          <div className='inline-cluster'>
                            <Badge tone='info'>{station.code}</Badge>
                            <Badge>{formatConnectorCount(station.connectorSummary.count)}</Badge>
                            <Badge>{getConnectorCurrentMixLabel(station.connectorSummary)}</Badge>
                            <Badge>Max {formatPowerKw(station.connectorSummary.maxPowerKw)} kW</Badge>
                          </div>
                        </div>
                        <div className='muted'>
                          <div>Brand: {station.brand} · {station.model}</div>
                          <div>Connector types: {getConnectorTypesLabel(station.connectorSummary)}</div>
                          <div>Serial: {station.serialNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className='list'>
                        <div className='inline-cluster'>
                          <Badge tone={getStatusTone(station.status)}>{formatEnumLabel(station.status)}</Badge>
                          {station.isArchived ? <Badge tone='warning'>Archived</Badge> : null}
                        </div>
                        <div className='muted'>
                          <div>Open issues: {station.summary?.openIssueCount ?? 0}</div>
                          <div>
                            Latest test:{' '}
                            {station.summary?.latestTestResult ? (
                              <Badge tone={getStatusTone(station.summary.latestTestResult)}>
                                {formatEnumLabel(station.summary.latestTestResult)}
                              </Badge>
                            ) : (
                              'No tests'
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>{station.location}</div>
                      <div className='muted'>
                        {station.modelTemplateVersion ? `Template v${station.modelTemplateVersion}` : 'Manual connector setup'}
                      </div>
                    </td>
                    {visibleFields.map((field) => (
                      <td key={field.id}>{formatCustomValue((station.customFields ?? {})[field.key])}</td>
                    ))}
                    <td>
                      <div className='list'>
                        <div>{formatRelativeTime(station.updatedAt)}</div>
                        <div className='muted'>{formatDateTime(station.updatedAt)}</div>
                      </div>
                    </td>
                    <td>
                      <div className='table-actions'>
                        <Link href={`/stations/${station.id}`} className='pill-link'>View</Link>
                        {canWrite ? <Link href={`/stations/${station.id}/edit`} className='pill-link'>Edit</Link> : null}
                        {isAdmin ? (
                          <ConfirmButton
                            label='Archive'
                            confirmText='Archive this station?'
                            onConfirm={() => archive.mutate(station.id)}
                            variant='secondary'
                          />
                        ) : null}
                        {isAdmin ? (
                          <ConfirmButton
                            label='Delete'
                            confirmText='Delete this station permanently?'
                            onConfirm={() => remove.mutate(station.id)}
                            variant='danger'
                          />
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className='pagination'>
            <p className='pagination-info'>
              Showing {rows.length === 0 ? 0 : start}-{end} of {meta?.total ?? 0} stations
            </p>
            <div className='inline-cluster'>
              <Button variant='secondary' onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
                Previous
              </Button>
              <Badge>Page {meta?.page ?? page} of {meta?.totalPages ?? 1}</Badge>
              <Button
                variant='secondary'
                onClick={() => onPageChange(page + 1)}
                disabled={!meta || page >= meta.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </TableShell>
  );
}
