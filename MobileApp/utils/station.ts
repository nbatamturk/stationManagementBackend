import type { StationEditableStatus, StationStatus } from '@/types';

export type StationDisplayStatus = StationStatus | 'archived';

export const STATION_STATUS_LABELS: Record<StationDisplayStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  faulty: 'Faulty',
  maintenance: 'Maintenance',
  archived: 'Archived',
};

export const STATION_STATUS_COLORS: Record<StationDisplayStatus, string> = {
  active: '#0F9D58',
  inactive: '#5F6368',
  faulty: '#D93025',
  maintenance: '#F9A825',
  archived: '#6D4C41',
};

export const currentTypeOptions = ['AC', 'DC'] as const;
export const stationEditableStatusOptions: StationEditableStatus[] = [
  'active',
  'maintenance',
  'inactive',
  'faulty',
];

export const getStationDisplayStatus = (
  status: StationStatus,
  isArchived = false,
): StationDisplayStatus => {
  if (isArchived) {
    return 'archived';
  }

  return status;
};
