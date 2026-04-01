'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogsClient } from '@/lib/api/audit-logs-client';
import { Input } from '@/components/ui/input';

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({ entityType: '', entityId: '', actorUserId: '', action: '', createdFrom: '', createdTo: '' });
  const { data } = useQuery({ queryKey: ['auditLogs', filters], queryFn: () => auditLogsClient.list({ ...filters, page: 1, limit: 50 }) });
  return <div className='card'><h3>Audit Logs</h3>
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>{Object.keys(filters).map((k) => <Input key={k} placeholder={k} value={(filters as any)[k]} onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value }))} />)}</div>
    <table className='table'><thead><tr><th>Date</th><th>Entity</th><th>Action</th><th>Actor</th></tr></thead><tbody>{data?.data.map((r) => <tr key={r.id}><td>{new Date(r.createdAt).toLocaleString()}</td><td>{r.entityType} / {r.entityId}</td><td>{r.action}</td><td>{r.actorUserId ?? 'system'}</td></tr>)}</tbody></table>
  </div>;
}
