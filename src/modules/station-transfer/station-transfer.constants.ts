import { currentTypeValues, socketTypeValues, stationStatusValues } from '../../contracts/domain';

export const customFieldColumnPrefix = 'cf.';
export { stationStatusValues };
export const stationCurrentTypeValues = currentTypeValues;
export const stationSocketTypeValues = socketTypeValues;

export const stationImportRequiredColumns = [
  'name',
  'code',
  'qrCode',
  'brand',
  'model',
  'serialNumber',
  'powerKw',
  'currentType',
  'socketType',
  'location',
] as const;

export const stationImportOptionalColumns = ['status', 'isArchived', 'lastTestDate', 'notes'] as const;
export const stationImportReadonlyColumns = ['archivedAt', 'createdAt', 'updatedAt'] as const;

export const stationExportBaseColumns = [
  ...stationImportRequiredColumns,
  ...stationImportOptionalColumns,
  ...stationImportReadonlyColumns,
] as const;

export type StationImportRequiredColumn = (typeof stationImportRequiredColumns)[number];
export type StationImportOptionalColumn = (typeof stationImportOptionalColumns)[number];
export type StationImportReadonlyColumn = (typeof stationImportReadonlyColumns)[number];
export type StationCsvAction = 'create' | 'update' | 'skip';
export type StationImportMode = 'upsert';
