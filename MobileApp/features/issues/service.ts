import { apiFetch } from '@/lib/api/http';
import { isApiError } from '@/lib/api/errors';
import type { IssueSeverity, IssueStatus, StationIssueRecord } from '@/types';

type SuccessResponse<T> = {
  data: T;
};

type ApiIssueRecord = {
  id: string;
  stationId: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  reportedBy: string | null;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const mapRecord = (record: ApiIssueRecord): StationIssueRecord => ({
  id: record.id,
  stationId: record.stationId,
  title: record.title,
  description: record.description,
  severity: record.severity,
  status: record.status,
  reportedAt: record.createdAt,
  resolvedAt: record.resolvedAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export const getStationIssueRecords = async (stationId: string): Promise<StationIssueRecord[]> => {
  try {
    const response = await apiFetch<SuccessResponse<ApiIssueRecord[]>>(
      `/stations/${stationId}/issues`,
    );

    return response.data.map(mapRecord);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return [];
    }

    throw error;
  }
};

export const addStationIssueRecord = async (input: {
  stationId: string;
  title: string;
  description?: string;
  severity?: IssueSeverity;
  status?: IssueStatus;
}): Promise<string> => {
  const response = await apiFetch<SuccessResponse<ApiIssueRecord>>(
    `/stations/${input.stationId}/issues`,
    {
      method: 'POST',
      body: JSON.stringify({
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        severity: input.severity,
      }),
    },
  );

  return response.data.id;
};
