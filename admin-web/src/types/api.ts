export type Role = 'admin' | 'operator' | 'viewer';
export type StationStatus = 'active' | 'maintenance' | 'inactive' | 'faulty' | 'archived';

export interface ApiError { code: string; message: string; details?: unknown }
export interface PaginatedMeta { page: number; limit: number; total: number; totalPages: number }
export interface PaginatedResponse<T> { data: T[]; meta: PaginatedMeta }
export interface SuccessResponse<T> { data: T }

export interface User {
  id: string; email: string; fullName: string; role: Role; isActive: boolean; createdAt?: string; updatedAt?: string;
}

export interface Station {
  id: string; name: string; code: string; qrCode: string; brand: string; model: string; serialNumber: string;
  powerKw: number; currentType: 'AC' | 'DC'; socketType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
  location: string; status: StationStatus; lastTestDate: string | null; notes: string | null; isArchived: boolean;
  archivedAt: string | null; createdAt: string; updatedAt: string; customFields: Record<string, unknown>;
}

export interface CustomField {
  id: string; key: string; label: string; type: 'text'|'number'|'boolean'|'select'|'date'|'json';
  optionsJson: unknown; isRequired: boolean; isFilterable: boolean; isVisibleInList: boolean; sortOrder: number; isActive: boolean;
  createdAt: string; updatedAt: string;
}

export interface AuditLog {
  id: string; actorUserId: string | null; entityType: string; entityId: string; action: string; metadataJson: Record<string, unknown>; createdAt: string;
}

export interface TestHistory { id: string; stationId: string; testDate: string; result: 'pass'|'fail'|'warning'; notes: string | null; metricsJson: Record<string, unknown>; createdAt: string; updatedAt: string }
export interface Issue { id: string; stationId: string; title: string; description: string | null; severity: 'low'|'medium'|'high'|'critical'; status: 'open'|'in_progress'|'resolved'|'closed'; assignedTo: string | null; createdAt: string; updatedAt: string }
