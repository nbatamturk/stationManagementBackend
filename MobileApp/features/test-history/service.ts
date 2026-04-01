import { apiFetch } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import type { StationTestHistoryRecord, TestResult } from '@/types';

type SuccessResponse<T> = {
  data: T;
};

type ApiTestHistoryRecord = {
  id: string;
  stationId: string;
  testDate: string;
  result: TestResult;
  notes: string | null;
  metrics: Record<string, unknown>;
  testedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

const mapRecord = (record: ApiTestHistoryRecord): StationTestHistoryRecord => ({
  id: record.id,
  stationId: record.stationId,
  testType:
    typeof record.metrics.testType === 'string' && record.metrics.testType.trim()
      ? record.metrics.testType.trim()
      : 'Station Test',
  result: record.result,
  performedAt: record.testDate,
  performedBy: record.testedBy,
  notes: record.notes,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const getStationTestHistory = async (stationId: string): Promise<StationTestHistoryRecord[]> => {
  try {
    const response = await apiFetch<SuccessResponse<ApiTestHistoryRecord[]>>(
      `/stations/${stationId}/test-history`,
    );

    return response.data.map(mapRecord);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return [];
    }

    throw error;
  }
};

export const addStationTestHistory = async (input: {
  stationId: string;
  testType: string;
  result: TestResult;
  performedAt?: string;
  performedBy?: string;
  notes?: string;
}): Promise<string> => {
  const response = await apiFetch<SuccessResponse<ApiTestHistoryRecord>>(
    `/stations/${input.stationId}/test-history`,
    {
      method: 'POST',
      body: JSON.stringify({
        testDate: input.performedAt,
        result: input.result,
        notes: input.notes?.trim() || undefined,
        metrics: input.testType.trim()
          ? {
              testType: input.testType.trim(),
            }
          : undefined,
      }),
    },
  );

  return response.data.id;
};
