import type { StationStatus } from '@/types';

export type StationDisplayStatus = StationStatus | 'archived';

export const STATION_STATUS_LABELS: Record<StationDisplayStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  faulty: 'Faulty',
  available: 'Available',
  in_use: 'In Use',
  maintenance: 'Maintenance',
  offline: 'Offline',
  retired: 'Retired',
  archived: 'Archived',
};

export const STATION_STATUS_COLORS: Record<StationDisplayStatus, string> = {
  active: '#0F9D58',
  inactive: '#5F6368',
  faulty: '#D93025',
  available: '#0F9D58',
  in_use: '#1976D2',
  maintenance: '#F9A825',
  offline: '#9E9E9E',
  retired: '#5F6368',
  archived: '#6D4C41',
};

export const currentTypeOptions = ['AC', 'DC'] as const;

export const getStationDisplayStatus = (
  status: StationStatus,
  isArchived = false,
): StationDisplayStatus => {
  if (isArchived) {
    return 'archived';
  }

  return status;
};
