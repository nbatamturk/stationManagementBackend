import { AuditLog, PaginatedResponse } from '@/types/api';
import { apiFetch } from './http';

export const auditLogsClient = {
  list: (query: Record<string, string | number | boolean | undefined>) => apiFetch<PaginatedResponse<AuditLog>>(`/audit-logs?${new URLSearchParams(Object.entries(query).filter(([,v]) => v !== undefined).map(([k,v])=>[k,String(v)]))}`),
};
