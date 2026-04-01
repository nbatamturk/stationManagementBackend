import type { CustomFieldType } from './custom-fields';

export type StationCurrentType = 'AC' | 'DC';

export type StationStatus =
  | 'active'
  | 'inactive'
  | 'faulty'
  | 'available'
  | 'in_use'
  | 'maintenance'
  | 'offline'
  | 'retired';

export type StationSortBy = 'name' | 'updatedAt' | 'powerKw';

export type StationListStatusFilter =
  | 'all'
  | 'archived'
  | 'active'
  | 'maintenance'
  | 'inactive'
  | 'faulty';

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

export interface Station {
  id: string;
  name: string;
  code: string;
  qrCode: string;
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
  isArchived?: boolean;
  archivedAt?: string | null;
  summary?: StationSummary;
  sync?: StationSync;
  customFields?: Record<string, unknown>;
}

export interface StationFormValues {
  name: string;
  code: string;
  qrCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: string;
  currentType: StationCurrentType;
  socketType: string;
  location: string;
  status: StationStatus;
  lastTestDate: string;
  notes: string;
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

export interface StationDraft extends Omit<Station, 'id' | 'createdAt' | 'updatedAt'> {
  id?: string;
}
