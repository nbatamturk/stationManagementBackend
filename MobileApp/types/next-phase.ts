export type TestResult = 'pass' | 'fail' | 'warning';

export interface StationTestHistoryRecord {
  id: string;
  stationId: string;
  testType: string;
  result: TestResult;
  performedAt: string;
  performedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface StationIssueRecord {
  id: string;
  stationId: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  reportedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
