import { SuccessResponse, TestHistory } from '@/types/api';
import { apiFetch } from './http';

export const testHistoryClient = {
  listByStation: (id: string) => apiFetch<{ data: TestHistory[] }>(`/stations/${id}/test-history`),
  create: (stationId: string, payload: { result: TestHistory['result']; notes?: string }) =>
    apiFetch<SuccessResponse<TestHistory>>(`/stations/${stationId}/test-history`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
