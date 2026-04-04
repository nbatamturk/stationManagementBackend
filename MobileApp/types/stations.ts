import type { CustomFieldType } from './custom-fields';

export type StationCurrentType = 'AC' | 'DC';
export type StationConnectorType = 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
export type StationEditableStatus = 'active' | 'maintenance' | 'inactive' | 'faulty';
export type StationStatus = StationEditableStatus;
export type StationSortBy = 'name' | 'updatedAt' | 'powerKw';
export type StationListStatusFilter = 'all' | 'archived' | StationEditableStatus;

export interface StationSummary {
  totalIssueCount: number;
  openIssueCount: number;
  hasOpenIssues: boolean;
  attachmentCount: number;
  testHistoryCount: number;
  latestTestResult: 'pass' | 'fail' | 'warning' | null;
}

export interface StationSync {
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletionMode: 'hard_delete';
  conflictFields?: Array<
    'status' | 'location' | 'lastTestDate' | 'notes' | 'customFields' | 'attachments' | 'issues'
  >;
}

export interface StationListCustomFieldFilter {
  fieldId: string;
  type: CustomFieldType;
  value: string;
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
  currentType: StationCurrentType;
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
  currentTypes: StationCurrentType[];
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
  currentType: StationCurrentType;
  socketType: string;
  location: string;
  status: StationStatus;
  lastTestDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  modelTemplateVersion: number | null;
  connectorSummary: StationConnectorSummary;
  connectors?: StationConnector[];
  summary?: StationSummary;
  sync?: StationSync;
  customFields?: Record<string, unknown>;
}

export interface StationConnectorFormValue {
  connectorNo: string;
  connectorType: StationConnectorType;
  currentType: StationCurrentType;
  powerKw: string;
  isActive: boolean;
}

export interface StationFormValues {
  name: string;
  code: string;
  qrCode: string;
  brandId: string;
  modelId: string;
  serialNumber: string;
  location: string;
  status: StationEditableStatus;
  lastTestDate: string;
  notes: string;
  connectors: StationConnectorFormValue[];
}

export interface StationListFilters {
  searchText: string;
  status: StationListStatusFilter;
  brand: string | 'all';
  model: string | 'all';
  currentType: StationCurrentType | 'all';
  sortBy: StationSortBy;
  customFieldFilters: StationListCustomFieldFilter[];
}

export interface StationDraft extends StationFormValues {
  id?: string;
}

export interface MobileAppVersionCheckResult {
  platform: 'ios' | 'android';
  appVersion: string;
  minimumSupportedVersion: string | null;
  downloadUrl: string | null;
  shouldWarn: boolean;
  warningMode: 'warn';
  message: string | null;
}
