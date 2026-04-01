import { Issue } from '@/types/api';
import { apiFetch } from './http';

export const issuesClient = {
  listByStation: (id: string) => apiFetch<{ data: Issue[] }>(`/stations/${id}/issues`),
  updateStatus: (id: string, status: Issue['status']) =>
    apiFetch<{ data: Issue }>(`/issues/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
