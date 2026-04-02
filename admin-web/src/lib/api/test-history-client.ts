import { SuccessResponse, TestHistory, TestHistoryCreatePayload, TestHistoryUpdatePayload } from '@/types/api';
import { apiFetch } from './http';

export const testHistoryClient = {
  listByStation: (id: string) => apiFetch<{ data: TestHistory[] }>(`/stations/${id}/test-history`),
  create: (stationId: string, payload: TestHistoryCreatePayload) =>
    apiFetch<SuccessResponse<TestHistory>>(`/stations/${stationId}/test-history`, { method: 'POST', body: JSON.stringify(payload) }),
  update: (id: string, payload: TestHistoryUpdatePayload) =>
    apiFetch<SuccessResponse<TestHistory>>(`/test-history/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  remove: (id: string) =>
    apiFetch<SuccessResponse<{ success: boolean; id: string }>>(`/test-history/${id}`, { method: 'DELETE' }),
};
