import {
  DashboardRecentIssue,
  DashboardRecentStation,
  DashboardRecentTest,
  DashboardSummary,
  SuccessResponse,
} from '@/types/api';
import { apiFetch } from './http';

export const dashboardClient = {
  getSummary: () => apiFetch<SuccessResponse<DashboardSummary>>('/dashboard/summary'),
  getRecentStations: (limit = 5) =>
    apiFetch<SuccessResponse<DashboardRecentStation[]>>(`/dashboard/recent-stations?${new URLSearchParams({ limit: String(limit) })}`),
  getRecentIssues: (limit = 5) =>
    apiFetch<SuccessResponse<DashboardRecentIssue[]>>(`/dashboard/recent-issues?${new URLSearchParams({ limit: String(limit) })}`),
  getRecentTests: (limit = 5) =>
    apiFetch<SuccessResponse<DashboardRecentTest[]>>(`/dashboard/recent-tests?${new URLSearchParams({ limit: String(limit) })}`),
};
