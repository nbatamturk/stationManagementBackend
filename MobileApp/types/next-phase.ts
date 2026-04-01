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

export interface StationPhotoAttachment {
  id: string;
  stationId: string;
  testHistoryId: string | null;
  issueId: string | null;
  localUri: string;
  mimeType: string | null;
  fileName: string | null;
  fileSize: number | null;
  syncStatus: 'local' | 'queued' | 'synced';
  createdAt: string;
}

export type DataOperationType = 'export' | 'import';
export type DataOperationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface DataExchangeRun {
  id: string;
  operationType: DataOperationType;
  status: DataOperationStatus;
  dataFormat: 'json' | 'csv' | 'zip';
  fileUri: string | null;
  summaryJson: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AppRole = 'admin' | 'engineer' | 'viewer';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: AppRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  role: AppRole;
  permissionKey: string;
}
