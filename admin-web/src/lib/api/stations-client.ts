import { PaginatedResponse, Station, SuccessResponse } from '@/types/api';
import { apiFetch } from './http';

export const stationsClient = {
  list: (query: Record<string, string | number | boolean | undefined>) => apiFetch<PaginatedResponse<Station>>(`/stations?${new URLSearchParams(Object.entries(query).filter(([,v]) => v !== undefined).map(([k,v])=>[k,String(v)]))}`),
  get: (id: string) => apiFetch<SuccessResponse<Station>>(`/stations/${id}`),
  create: (payload: Partial<Station>) => apiFetch<SuccessResponse<Station>>('/stations', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: Partial<Station>) => apiFetch<SuccessResponse<Station>>(`/stations/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  archive: (id: string) => apiFetch<SuccessResponse<Station>>(`/stations/${id}/archive`, { method: 'POST' }),
  remove: (id: string) => apiFetch<SuccessResponse<{ success: boolean; id: string }>>(`/stations/${id}`, { method: 'DELETE' }),
};
