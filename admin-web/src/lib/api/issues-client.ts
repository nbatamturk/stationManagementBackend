import { Issue, IssueCreatePayload, IssueStatus, IssueUpdatePayload, SuccessResponse } from '@/types/api';
import { apiFetch } from './http';

export const issuesClient = {
  listByStation: (id: string) => apiFetch<{ data: Issue[] }>(`/stations/${id}/issues`),
  get: (id: string) => apiFetch<SuccessResponse<Issue>>(`/issues/${id}`),
  create: (stationId: string, payload: IssueCreatePayload) =>
    apiFetch<SuccessResponse<Issue>>(`/stations/${stationId}/issues`, { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: IssueUpdatePayload) =>
    apiFetch<SuccessResponse<Issue>>(`/issues/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  updateStatus: (id: string, status: IssueStatus) =>
    apiFetch<SuccessResponse<Issue>>(`/issues/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  remove: (id: string) => apiFetch<SuccessResponse<{ success: boolean; id: string }>>(`/issues/${id}`, { method: 'DELETE' }),
};
