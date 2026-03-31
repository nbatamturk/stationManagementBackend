import { SuccessResponse, TestHistory } from '@/types/api';
import { apiFetch } from './http';

export const testHistoryClient = {
  listByStation: (id: string) => apiFetch<{ data: TestHistory[] }>(`/stations/${id}/test-history`),
};
