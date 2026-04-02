export type Role = 'admin' | 'operator' | 'viewer';
export type StationStatus = 'active' | 'maintenance' | 'inactive' | 'faulty';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TestResult = 'pass' | 'fail' | 'warning';
export type CustomFieldType = 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';

export interface ApiError { code: string; message: string; details?: unknown }
export interface PaginatedMeta { page: number; limit: number; total: number; totalPages: number }
export interface PaginatedResponse<T> { data: T[]; meta: PaginatedMeta }
export interface SuccessResponse<T> { data: T }

export interface User {
  id: string; email: string; fullName: string; role: Role; isActive: boolean; createdAt?: string; updatedAt?: string;
}

export interface StationSummary {
  totalIssueCount: number; openIssueCount: number; hasOpenIssues: boolean; attachmentCount: number; testHistoryCount: number; latestTestResult: TestResult | null;
}

export interface StationSync {
  updatedAt: string; isArchived: boolean; archivedAt: string | null; isDeleted: boolean; deletedAt: string | null; deletionMode: 'hard_delete'; conflictFields?: Array<'status' | 'location' | 'lastTestDate' | 'notes' | 'customFields' | 'attachments' | 'issues'>;
}

export interface Station {
  id: string; name: string; code: string; qrCode: string; brand: string; model: string; serialNumber: string;
  powerKw: number; currentType: 'AC' | 'DC'; socketType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
  location: string; status: StationStatus; lastTestDate: string | null; notes: string | null; isArchived: boolean;
  archivedAt: string | null; createdAt: string; updatedAt: string; customFields: Record<string, unknown>; summary?: StationSummary; sync?: StationSync;
}

export interface CustomField {
  id: string; key: string; label: string; type: CustomFieldType;
  options: unknown; isRequired: boolean; isFilterable: boolean; isVisibleInList: boolean; sortOrder: number; isActive: boolean;
  createdAt: string; updatedAt: string;
}

export interface AuditLog {
  id: string; actorUserId: string | null; entityType: string; entityId: string; action: string; metadata: Record<string, unknown>; createdAt: string;
}

export interface TestHistory {
  id: string;
  stationId: string;
  testDate: string;
  result: TestResult;
  notes: string | null;
  metrics: Record<string, unknown>;
  testedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: string;
  stationId: string;
  title: string;
  description: string | null;
  severity: IssueSeverity;
  status: IssueStatus;
  reportedBy?: string | null;
  assignedTo: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardSummary {
  totalStations: number;
  activeStations: number;
  archivedStations: number;
  maintenanceStations: number;
  faultyStations: number;
  totalOpenIssues: number;
  totalCriticalIssues: number;
  recentTestCount: number;
}

export interface DashboardRecentStation {
  id: string;
  name: string;
  code: string;
  status: StationStatus;
  isArchived: boolean;
  updatedAt: string;
}

export interface DashboardRecentIssue {
  id: string;
  stationId: string;
  stationName: string;
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  createdAt: string;
}

export interface DashboardRecentTest {
  id: string;
  stationId: string;
  stationName: string;
  result: TestResult;
  testDate: string;
  createdAt: string;
}

export interface IssueCreatePayload {
  title: string;
  description?: string;
  severity?: IssueSeverity;
  assignedTo?: string;
}

export interface IssueUpdatePayload {
  title?: string;
  description?: string | null;
  severity?: IssueSeverity;
  status?: IssueStatus;
  assignedTo?: string | null;
}

export interface TestHistoryCreatePayload {
  testDate?: string;
  result: TestResult;
  notes?: string;
  metrics?: Record<string, unknown>;
}

export interface TestHistoryUpdatePayload {
  testDate?: string;
  result?: TestResult;
  notes?: string | null;
  metrics?: Record<string, unknown>;
}
