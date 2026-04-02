'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { customFieldsClient } from '@/lib/api/custom-fields-client';
import { issuesClient } from '@/lib/api/issues-client';
import { stationsClient } from '@/lib/api/stations-client';
import { testHistoryClient } from '@/lib/api/test-history-client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatCustomValue, formatDate, formatDateTime, formatEnumLabel, formatRelativeTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { StateCard } from '@/components/ui/state-card';

function getTone(value: string) {
  if (value === 'active' || value === 'pass' || value === 'resolved' || value === 'closed') {
    return 'success';
  }

  if (value === 'maintenance' || value === 'warning' || value === 'in_progress') {
    return 'warning';
  }

  if (value === 'faulty' || value === 'fail' || value === 'critical' || value === 'open') {
    return 'danger';
  }

  return 'neutral';
}

export default function StationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { canWrite } = useAuth();
  const station = useQuery({ queryKey: ['station', id], queryFn: () => stationsClient.get(id) });
  const customFields = useQuery({ queryKey: ['station-custom-fields'], queryFn: () => customFieldsClient.list(true) });
  const tests = useQuery({ queryKey: ['station-tests', id], queryFn: () => testHistoryClient.listByStation(id) });
  const issues = useQuery({ queryKey: ['station-issues', id], queryFn: () => issuesClient.listByStation(id) });

  if (station.isLoading) {
    return <StateCard title='Loading station' description='Gathering station details, issues, and test history.' />;
  }

  if (!station.data) {
    return <StateCard title='Station not found' description='The requested station could not be found.' tone='warning' />;
  }

  const currentStation = station.data.data;
  const issueItems = issues.data?.data ?? [];
  const testItems = tests.data?.data ?? [];
  const definitionMap = new Map((customFields.data?.data ?? []).map((field) => [field.key, field]));
  const customFieldEntries = Object.entries(currentStation.customFields ?? {}).sort((left, right) => {
    const leftOrder = definitionMap.get(left[0])?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = definitionMap.get(right[0])?.sortOrder ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left[0].localeCompare(right[0]);
  });

  return (
    <div className='page-stack'>
      <PageHeader
        title={currentStation.name}
        description={`${currentStation.code} · ${currentStation.brand} ${currentStation.model}`}
        actions={
          <div className='page-header-actions'>
            {canWrite ? <Link href={`/stations/${id}/edit`} className='pill-link'>Edit station</Link> : null}
            <Link href={`/issues?stationId=${id}`} className='pill-link'>Issue workspace</Link>
            <Link href={`/test-history?stationId=${id}`} className='pill-link'>Test history</Link>
          </div>
        }
      />

      <div className='summary-grid'>
        <div className='card metric-card'>
          <p className='eyebrow'>Operational status</p>
          <div className='inline-cluster'>
            <Badge tone={getTone(currentStation.status)}>{formatEnumLabel(currentStation.status)}</Badge>
            {currentStation.isArchived ? <Badge tone='warning'>Archived</Badge> : null}
          </div>
          <p className='muted'>
            {currentStation.isArchived && currentStation.archivedAt
              ? `Archived ${formatDateTime(currentStation.archivedAt)}`
              : 'Visible in active operations.'}
          </p>
        </div>
        <div className='card metric-card'>
          <p className='eyebrow'>Issues</p>
          <p className='kpi-value'>{currentStation.summary?.openIssueCount ?? 0}</p>
          <p className='muted'>Open issues out of {currentStation.summary?.totalIssueCount ?? 0} total records.</p>
        </div>
        <div className='card metric-card'>
          <p className='eyebrow'>Test coverage</p>
          <p className='kpi-value'>{currentStation.summary?.testHistoryCount ?? 0}</p>
          <p className='muted'>
            Latest result:{' '}
            {currentStation.summary?.latestTestResult ? formatEnumLabel(currentStation.summary.latestTestResult) : 'No tests'}
          </p>
        </div>
        <div className='card metric-card'>
          <p className='eyebrow'>Attachments</p>
          <p className='kpi-value'>{currentStation.summary?.attachmentCount ?? 0}</p>
          <p className='muted'>Stored evidence and related files.</p>
        </div>
      </div>

      <div className='split-grid'>
        <div className='card meta-list'>
          <div>
            <h3>Station details</h3>
            <p className='muted'>The key operational attributes used across the app.</p>
          </div>
          <div className='meta-row'><span className='meta-label'>Location</span><span>{currentStation.location}</span></div>
          <div className='meta-row'><span className='meta-label'>Power</span><span>{currentStation.powerKw} kW</span></div>
          <div className='meta-row'><span className='meta-label'>Connector</span><span>{currentStation.currentType} · {currentStation.socketType}</span></div>
          <div className='meta-row'><span className='meta-label'>Serial number</span><span>{currentStation.serialNumber}</span></div>
          <div className='meta-row'><span className='meta-label'>Last test date</span><span>{formatDate(currentStation.lastTestDate)}</span></div>
          <div className='meta-row'><span className='meta-label'>Created</span><span>{formatDateTime(currentStation.createdAt)}</span></div>
          <div className='meta-row'><span className='meta-label'>Updated</span><span>{formatRelativeTime(currentStation.updatedAt)} · {formatDateTime(currentStation.updatedAt)}</span></div>
        </div>

        <div className='card page-stack'>
          <div>
            <h3>Notes</h3>
            <p className='muted'>Free-form context for internal teams.</p>
          </div>
          <div className='subtle-box'>
            {currentStation.notes ? <p>{currentStation.notes}</p> : <p className='muted'>No notes have been added for this station.</p>}
          </div>
        </div>
      </div>

      <div className='card page-stack'>
        <div>
          <h3>Custom fields</h3>
          <p className='muted'>Formatted from the active custom field definitions instead of raw JSON output.</p>
        </div>
        {customFieldEntries.length === 0 ? (
          <p className='muted'>No custom field values are stored for this station.</p>
        ) : (
          <div className='detail-grid'>
            {customFieldEntries.map(([key, value]) => {
              const definition = definitionMap.get(key);
              return (
                <div key={key} className='subtle-box'>
                  <p className='eyebrow'>{definition?.type ?? 'Custom field'}</p>
                  <strong>{definition?.label ?? key}</strong>
                  <p className='muted'>{formatCustomValue(value)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className='split-grid'>
        <div className='card list'>
          <div className='stack-row' style={{ justifyContent: 'space-between' }}>
            <div>
              <h3>Issues</h3>
              <p className='muted'>Connected to the station workflow and linked into the issue workspace.</p>
            </div>
            <Link href={`/issues?stationId=${id}`} className='pill-link'>Open all issues</Link>
          </div>
          {issueItems.length === 0 ? (
            <p className='muted'>No issues are recorded for this station.</p>
          ) : (
            issueItems.slice(0, 5).map((issue) => (
              <Link key={issue.id} href={`/issues/${issue.id}`} className='list-item'>
                <div className='stack-row' style={{ justifyContent: 'space-between' }}>
                  <strong>{issue.title}</strong>
                  <div className='inline-cluster'>
                    <Badge tone={getTone(issue.severity)}>{formatEnumLabel(issue.severity)}</Badge>
                    <Badge tone={getTone(issue.status)}>{formatEnumLabel(issue.status)}</Badge>
                  </div>
                </div>
                <p className='muted'>{issue.description || 'No issue description provided.'}</p>
              </Link>
            ))
          )}
        </div>

        <div className='card list'>
          <div className='stack-row' style={{ justifyContent: 'space-between' }}>
            <div>
              <h3>Recent tests</h3>
              <p className='muted'>Latest results that influenced the station summary.</p>
            </div>
            <Link href={`/test-history?stationId=${id}`} className='pill-link'>Open test history</Link>
          </div>
          {testItems.length === 0 ? (
            <p className='muted'>No tests are recorded for this station yet.</p>
          ) : (
            testItems.slice(0, 5).map((test) => (
              <Link key={test.id} href={`/test-history?stationId=${id}`} className='list-item'>
                <div className='stack-row' style={{ justifyContent: 'space-between' }}>
                  <strong>{formatDateTime(test.testDate)}</strong>
                  <Badge tone={getTone(test.result)}>{formatEnumLabel(test.result)}</Badge>
                </div>
                <p className='muted'>{test.notes || 'No notes captured for this test run.'}</p>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
