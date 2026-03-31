import { Issue } from '@/types/api';
import { apiFetch } from './http';

export const issuesClient = {
  listByStation: (id: string) => apiFetch<{ data: Issue[] }>(`/stations/${id}/issues`),
};
