'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { stationsClient } from '@/lib/api/stations-client';
import { issuesClient } from '@/lib/api/issues-client';
import { testHistoryClient } from '@/lib/api/test-history-client';

export default function StationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const station = useQuery({ queryKey: ['station', id], queryFn: () => stationsClient.get(id) });
  const tests = useQuery({ queryKey: ['tests', id], queryFn: () => testHistoryClient.listByStation(id) });
  const issues = useQuery({ queryKey: ['issues', id], queryFn: () => issuesClient.listByStation(id) });
  if (station.isLoading) return <div>Loading...</div>;
  if (!station.data) return <div>Not found</div>;
  const s = station.data.data;
  return <div style={{display:'grid',gap:12}}>
    <div className='card'><h2>{s.name}</h2><p>{s.location}</p><p>Status: {s.status}</p><pre>{JSON.stringify(s.customFields, null, 2)}</pre><Link href={`/stations/${id}/edit`}>Edit Station</Link></div>
    <div className='card'><h3>Test History</h3>{tests.data?.data.map((t) => <div key={t.id}>{t.result} - {new Date(t.testDate).toLocaleDateString()}</div>) ?? 'No test history'}</div>
    <div className='card'><h3>Issues</h3>{issues.data?.data.map((i) => <div key={i.id}>{i.title} ({i.status})</div>) ?? 'No issues'}</div>
  </div>;
}
