export type Role = 'admin' | 'operator' | 'viewer';
export type StationStatus = 'active' | 'maintenance' | 'inactive' | 'faulty';
export type CurrentType = 'AC' | 'DC';
export type StationConnectorType = 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TestResult = 'pass' | 'fail' | 'warning';
export type CustomFieldType = 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
export type MobilePlatform = 'ios' | 'android';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export interface SuccessResponse<T> {
  data: T;
}

export interface DeleteResult {
  success: true;
  id: string;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponseData {
  success: true;
}

export interface StationSummary {
  totalIssueCount: number;
  openIssueCount: number;
  hasOpenIssues: boolean;
  attachmentCount: number;
  testHistoryCount: number;
  latestTestResult: TestResult | null;
}

export interface StationSync {
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletionMode: 'hard_delete';
  conflictFields?: Array<'status' | 'location' | 'lastTestDate' | 'notes' | 'customFields' | 'attachments' | 'issues'>;
}

export interface StationConnectorSummary {
  types: StationConnectorType[];
  maxPowerKw: number;
  hasAC: boolean;
  hasDC: boolean;
  count: number;
}

export interface StationConnectorInput {
  connectorNo: number;
  connectorType: StationConnectorType;
  currentType: CurrentType;
  powerKw: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface StationConnector extends StationConnectorInput {
  id: string;
  isActive: boolean;
  sortOrder: number;
}

export interface StationCatalogBrand {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StationCatalogModel {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  latestTemplateVersion: number | null;
  latestTemplateConnectors: StationConnectorInput[];
}

export interface StationConfig {
  statuses: StationStatus[];
  currentTypes: CurrentType[];
  connectorTypes: StationConnectorType[];
  brands: StationCatalogBrand[];
  models: StationCatalogModel[];
}

export interface Station {
  id: string;
  name: string;
  code: string;
  qrCode: string;
  brandId: string;
  modelId: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: number;
  currentType: CurrentType;
  socketType: string;
  location: string;
  status: StationStatus;
  lastTestDate: string | null;
  notes: string | null;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  modelTemplateVersion: number | null;
  connectorSummary: StationConnectorSummary;
  connectors?: StationConnector[];
  customFields?: Record<string, unknown>;
  summary?: StationSummary;
  sync?: StationSync;
}

export interface StationWritePayload {
  name: string;
  code: string;
  qrCode: string;
  brandId: string;
  modelId: string;
  serialNumber: string;
  location: string;
  status?: StationStatus;
  lastTestDate?: string | null;
  notes?: string | null;
  connectors: StationConnectorInput[];
  customFields?: Record<string, unknown>;
}

export interface CustomField {
  id: string;
  key: string;
  label: string;
  type: CustomFieldType;
  options: unknown;
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleInList: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldCreatePayload {
  key: string;
  label: string;
  type: CustomFieldType;
  options?: Record<string, unknown>;
  isRequired?: boolean;
  isFilterable?: boolean;
  isVisibleInList?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

export interface CustomFieldUpdatePayload {
  label: string;
  type: CustomFieldType;
  options?: Record<string, unknown>;
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleInList: boolean;
  sortOrder: number;
}

export interface AuditLog {
  id: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
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

export interface MobileAppConfig {
  iosMinimumSupportedVersion: string | null;
  androidMinimumSupportedVersion: string | null;
  iosDownloadUrl: string | null;
  androidDownloadUrl: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
}

export interface MobileAppConfigUpdatePayload {
  iosMinimumSupportedVersion: string | null;
  androidMinimumSupportedVersion: string | null;
  iosDownloadUrl: string | null;
  androidDownloadUrl: string | null;
}

export interface MobileAppVersionCheckPayload {
  platform: MobilePlatform;
  appVersion: string;
}

export interface MobileAppVersionCheckResult {
  platform: MobilePlatform;
  appVersion: string;
  minimumSupportedVersion: string | null;
  downloadUrl: string | null;
  shouldWarn: boolean;
  warningMode: 'warn';
  message: string | null;
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
