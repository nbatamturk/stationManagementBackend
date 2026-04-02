'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { dashboardClient } from '@/lib/api/dashboard-client';
import { stationsClient } from '@/lib/api/stations-client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDateTime, formatEnumLabel, formatRelativeTime } from '@/lib/format';
import { DashboardRecentIssue, DashboardRecentStation, DashboardRecentTest } from '@/types/api';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { StateCard } from '@/components/ui/state-card';

function StatusTone({ status }: { status: string }) {
  if (status === 'active' || status === 'pass' || status === 'resolved' || status === 'closed') {
    return <Badge tone='success'>{formatEnumLabel(status)}</Badge>;
  }

  if (status === 'maintenance' || status === 'warning' || status === 'in_progress') {
    return <Badge tone='warning'>{formatEnumLabel(status)}</Badge>;
  }

  if (status === 'faulty' || status === 'fail' || status === 'critical' || status === 'open') {
    return <Badge tone='danger'>{formatEnumLabel(status)}</Badge>;
  }

  return <Badge>{formatEnumLabel(status)}</Badge>;
}

function MetricCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className='card kpi-card'>
      <p className='eyebrow'>{label}</p>
      <p className='kpi-value'>{value.toLocaleString()}</p>
      <p className='muted'>{hint}</p>
    </div>
  );
}

function RecentStationsCard({ items }: { items: DashboardRecentStation[] }) {
  return (
    <div className='card list'>
      <div className='stack-row' style={{ justifyContent: 'space-between' }}>
        <div>
          <h3>Recent station changes</h3>
          <p className='muted'>Latest updates across the station inventory.</p>
        </div>
        <Link href='/stations' className='pill-link'>Open stations</Link>
      </div>
      {items.length === 0 ? (
        <p className='muted'>No recent station activity yet.</p>
      ) : (
        items.map((station) => (
          <Link key={station.id} href={`/stations/${station.id}`} className='list-item'>
            <div className='stack-row' style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{station.name}</strong>
                <p className='muted'>{station.code}</p>
              </div>
              <div className='inline-cluster'>
                <StatusTone status={station.status} />
                {station.isArchived ? <Badge tone='warning'>Archived</Badge> : null}
              </div>
            </div>
            <p className='muted'>{formatRelativeTime(station.updatedAt)} · {formatDateTime(station.updatedAt)}</p>
          </Link>
        ))
      )}
    </div>
  );
}

function RecentIssuesCard({ items }: { items: DashboardRecentIssue[] }) {
  return (
    <div className='card list'>
      <div className='stack-row' style={{ justifyContent: 'space-between' }}>
        <div>
          <h3>Recent issues</h3>
          <p className='muted'>What needs attention right now.</p>
        </div>
        <Link href='/issues' className='pill-link'>Open issues</Link>
      </div>
      {items.length === 0 ? (
        <p className='muted'>No issues have been reported recently.</p>
      ) : (
        items.map((issue) => (
          <Link key={issue.id} href={`/issues/${issue.id}`} className='list-item'>
            <div className='stack-row' style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{issue.title}</strong>
                <p className='muted'>{issue.stationName}</p>
              </div>
              <div className='inline-cluster'>
                <StatusTone status={issue.severity} />
                <StatusTone status={issue.status} />
              </div>
            </div>
            <p className='muted'>{formatDateTime(issue.createdAt)}</p>
          </Link>
        ))
      )}
    </div>
  );
}

function RecentTestsCard({ items }: { items: DashboardRecentTest[] }) {
  return (
    <div className='card list'>
      <div className='stack-row' style={{ justifyContent: 'space-between' }}>
        <div>
          <h3>Recent tests</h3>
          <p className='muted'>Latest recorded station test outcomes.</p>
        </div>
        <Link href='/test-history' className='pill-link'>Open test history</Link>
      </div>
      {items.length === 0 ? (
        <p className='muted'>No recent tests have been logged.</p>
      ) : (
        items.map((test) => (
          <Link key={test.id} href={`/test-history?stationId=${test.stationId}`} className='list-item'>
            <div className='stack-row' style={{ justifyContent: 'space-between' }}>
              <div>
                <strong>{test.stationName}</strong>
                <p className='muted'>{formatDateTime(test.testDate)}</p>
              </div>
              <StatusTone status={test.result} />
            </div>
            <p className='muted'>Logged {formatRelativeTime(test.createdAt)}</p>
          </Link>
        ))
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { isAdmin } = useAuth();

  const adminSummary = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => dashboardClient.getSummary(),
    enabled: isAdmin,
  });
  const adminRecentStations = useQuery({
    queryKey: ['dashboard-recent-stations'],
    queryFn: () => dashboardClient.getRecentStations(5),
    enabled: isAdmin,
  });
  const adminRecentIssues = useQuery({
    queryKey: ['dashboard-recent-issues'],
    queryFn: () => dashboardClient.getRecentIssues(5),
    enabled: isAdmin,
  });
  const adminRecentTests = useQuery({
    queryKey: ['dashboard-recent-tests'],
    queryFn: () => dashboardClient.getRecentTests(5),
    enabled: isAdmin,
  });

  const totalStations = useQuery({
    queryKey: ['dashboard-total-stations'],
    queryFn: () => stationsClient.list({ page: 1, limit: 1, includeArchived: true, view: 'compact' }),
    enabled: !isAdmin,
  });
  const activeStations = useQuery({
    queryKey: ['dashboard-active-stations'],
    queryFn: () => stationsClient.list({ page: 1, limit: 1, status: 'active', includeArchived: false, view: 'compact' }),
    enabled: !isAdmin,
  });
  const maintenanceStations = useQuery({
    queryKey: ['dashboard-maintenance-stations'],
    queryFn: () => stationsClient.list({ page: 1, limit: 1, status: 'maintenance', includeArchived: false, view: 'compact' }),
    enabled: !isAdmin,
  });
  const faultyStations = useQuery({
    queryKey: ['dashboard-faulty-stations'],
    queryFn: () => stationsClient.list({ page: 1, limit: 1, status: 'faulty', includeArchived: false, view: 'compact' }),
    enabled: !isAdmin,
  });
  const archivedStations = useQuery({
    queryKey: ['dashboard-archived-stations'],
    queryFn: () => stationsClient.list({ page: 1, limit: 1, isArchived: true, view: 'compact' }),
    enabled: !isAdmin,
  });
  const operatorRecentStations = useQuery({
    queryKey: ['dashboard-operator-recent-stations'],
    queryFn: () =>
      stationsClient.list({
        page: 1,
        limit: 5,
        includeArchived: true,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        view: 'compact',
      }),
    enabled: !isAdmin,
  });
  const operatorAttentionStations = useQuery({
    queryKey: ['dashboard-operator-attention-stations'],
    queryFn: () =>
      stationsClient.list({
        page: 1,
        limit: 5,
        includeArchived: false,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
        view: 'compact',
        status: 'faulty',
      }),
    enabled: !isAdmin,
  });

  if (isAdmin && adminSummary.error) {
    return (
      <StateCard
        title='Dashboard unavailable'
        description={(adminSummary.error as Error).message || 'The dashboard data could not be loaded right now.'}
        tone='danger'
      />
    );
  }

  const summary = isAdmin
    ? adminSummary.data?.data
    : {
        totalStations: totalStations.data?.meta.total ?? 0,
        activeStations: activeStations.data?.meta.total ?? 0,
        archivedStations: archivedStations.data?.meta.total ?? 0,
        maintenanceStations: maintenanceStations.data?.meta.total ?? 0,
        faultyStations: faultyStations.data?.meta.total ?? 0,
      };

  const recentStations = isAdmin
    ? adminRecentStations.data?.data ?? []
    : (operatorRecentStations.data?.data ?? []).map((station) => ({
        id: station.id,
        name: station.name,
        code: station.code,
        status: station.status,
        isArchived: station.isArchived,
        updatedAt: station.updatedAt,
      }));

  const attentionStations = (operatorAttentionStations.data?.data ?? []).map((station) => ({
    id: station.id,
    title: `${station.name} needs review`,
    stationId: station.id,
    stationName: station.name,
    severity: station.status === 'faulty' ? 'critical' : 'medium',
    status: station.status === 'faulty' ? 'open' : 'in_progress',
    createdAt: station.updatedAt,
  })) as DashboardRecentIssue[];

  return (
    <div className='page-stack'>
      <PageHeader
        title='Dashboard'
        description={
          isAdmin
            ? 'Monitor station health, recent operational activity, and exceptions from one place.'
            : 'Stay on top of fleet status changes and stations that need immediate attention.'
        }
      />

      <div className='summary-grid'>
        <MetricCard label='Total stations' value={summary?.totalStations ?? 0} hint='Entire station inventory.' />
        <MetricCard label='Active' value={summary?.activeStations ?? 0} hint='Stations currently operational.' />
        <MetricCard label='Maintenance' value={summary?.maintenanceStations ?? 0} hint='Stations undergoing planned work.' />
        <MetricCard label='Faulty' value={summary?.faultyStations ?? 0} hint='Stations flagged for urgent attention.' />
        <MetricCard
          label='Archived'
          value={summary?.archivedStations ?? 0}
          hint='Archived stations kept out of active workflows.'
        />
        {isAdmin ? (
          <MetricCard label='Open issues' value={adminSummary.data?.data.totalOpenIssues ?? 0} hint='Open and in-progress issue volume.' />
        ) : null}
        {isAdmin ? (
          <MetricCard label='Critical issues' value={adminSummary.data?.data.totalCriticalIssues ?? 0} hint='High-priority unresolved issue load.' />
        ) : null}
        {isAdmin ? (
          <MetricCard label='Tests logged (7d)' value={adminSummary.data?.data.recentTestCount ?? 0} hint='Recent verification activity across the fleet.' />
        ) : null}
      </div>

      <div className='dashboard-grid'>
        <RecentStationsCard items={recentStations} />
        {isAdmin ? (
          <RecentIssuesCard items={adminRecentIssues.data?.data ?? []} />
        ) : (
          <RecentIssuesCard items={attentionStations} />
        )}
      </div>

      {isAdmin ? <RecentTestsCard items={adminRecentTests.data?.data ?? []} /> : null}
    </div>
  );
}
