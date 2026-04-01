'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { stationsClient } from '@/lib/api/stations-client';

export default function DashboardPage() {
  const { data } = useQuery({ queryKey: ['dashboardStations'], queryFn: () => stationsClient.list({ page: 1, limit: 100 }) });
  const total = data?.meta.total ?? 0;
  const active = data?.data.filter((s) => s.status === 'active').length ?? 0;
  const archived = data?.data.filter((s) => s.isArchived).length ?? 0;
  const recent = [...(data?.data ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  return <div style={{display:'grid',gap:16}}>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12}}>
      <div className='card'><b>Total Stations</b><div>{total}</div></div>
      <div className='card'><b>Active</b><div>{active}</div></div>
      <div className='card'><b>Archived</b><div>{archived}</div></div>
    </div>
    <div className='card'><b>Recently Updated Stations</b>{recent.map((s) => <div key={s.id}>{s.name} - {new Date(s.updatedAt).toLocaleString()}</div>)}</div>
    <div className='card'><b>Quick Links</b><div style={{display:'flex',gap:10,marginTop:8}}><Link href='/stations'>Stations</Link><Link href='/custom-fields'>Custom Fields</Link><Link href='/users'>Users</Link><Link href='/audit-logs'>Audit Logs</Link></div></div>
  </div>;
}
