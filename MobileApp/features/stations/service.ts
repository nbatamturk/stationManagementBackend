import { getCustomFieldDefinitions } from '@/features/custom-fields';
import { isApiError } from '@/lib/api/errors';
import { apiFetch } from '@/lib/api/http';
import type {
  CustomFieldDefinition,
  Station,
  StationCustomValuesByFieldId,
  StationDraft,
  StationListFilters,
} from '@/types';
import { dateOnlyToIsoDateTime, isValidDateOnly, isoToDateOnly } from '@/utils/date';
import { parseSelectOptions } from '@/utils/custom-field';

import type { StationDetails, StationListItem } from './types';

type SuccessResponse<T> = {
  data: T;
};

type PaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ApiStation = {
  id: string;
  name: string;
  code: string;
  qrCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: number;
  currentType: Station['currentType'];
  socketType: string;
  location: string;
  status: Extract<Station['status'], 'active' | 'maintenance' | 'inactive' | 'faulty'>;
  lastTestDate: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  summary: NonNullable<Station['summary']>;
  sync: NonNullable<Station['sync']>;
  customFields?: Record<string, unknown>;
};

type StationListQuery = Record<string, string | number | boolean | undefined>;
type StationUpsertPayload = {
  name: string;
  code: string;
  qrCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: number;
  currentType: Station['currentType'];
  socketType: StationDraft['socketType'];
  location: string;
  status: Extract<Station['status'], 'active' | 'maintenance' | 'inactive' | 'faulty'>;
  lastTestDate?: string | null;
  notes?: string | null;
  customFields?: Record<string, unknown>;
};

const DEFAULT_PAGE_SIZE = 100;

type StationFilterMetadataFilters = Pick<
  StationListFilters,
  'searchText' | 'status' | 'brand' | 'currentType'
>;

const formatCustomFieldValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
};

const trimToUndefined = (value: string): string | undefined => {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
};

const trimToNull = (value: string): string | null => {
  const normalized = value.trim();
  return normalized ? normalized : null;
};

const parsePowerKw = (value: string): number => {
  const normalized = value.trim();
  const parsed = Number(normalized);

  if (!normalized || Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    throw new Error('Power (kW) must be a valid number.');
  }

  return parsed;
};

const serializeCustomFieldValue = (
  definition: CustomFieldDefinition,
  rawValue: string,
): unknown => {
  const normalized = rawValue.trim();

  if (!normalized) {
    return null;
  }

  switch (definition.type) {
    case 'text':
      return normalized;
    case 'number': {
      const parsed = Number(normalized);

      if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
        throw new Error(`${definition.label} must be a valid number.`);
      }

      return parsed;
    }
    case 'boolean':
      if (normalized === 'true') {
        return true;
      }

      if (normalized === 'false') {
        return false;
      }

      throw new Error(`${definition.label} must be Yes, No, or unset.`);
    case 'date':
      if (!isValidDateOnly(normalized)) {
        throw new Error(`${definition.label} must use YYYY-MM-DD format.`);
      }

      return dateOnlyToIsoDateTime(normalized);
    case 'select': {
      const options = parseSelectOptions(definition.optionsJson);

      if (options.length > 0 && !options.includes(normalized)) {
        throw new Error(`${definition.label} must be one of the configured options.`);
      }

      return normalized;
    }
    case 'json':
      try {
        return JSON.parse(normalized) as unknown;
      } catch {
        throw new Error(`${definition.label} must contain valid JSON.`);
      }
    default:
      throw new Error(`Unsupported custom field type for ${definition.label}.`);
  }
};

const buildStationUpsertPayload = async (
  draft: StationDraft,
  customValues: StationCustomValuesByFieldId,
): Promise<StationUpsertPayload> => {
  const definitions = await getCustomFieldDefinitions(true);
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]));
  const isEditMode = Boolean(draft.id);
  const customFields: Record<string, unknown> = {};

  for (const [fieldId, rawValue] of Object.entries(customValues)) {
    const definition = definitionById.get(fieldId);

    if (!definition) {
      continue;
    }

    customFields[definition.key] = serializeCustomFieldValue(definition, rawValue);
  }

  const normalizedLastTestDate = draft.lastTestDate.trim();

  if (normalizedLastTestDate && !isValidDateOnly(normalizedLastTestDate)) {
    throw new Error('Last test date must use YYYY-MM-DD format.');
  }

  return {
    name: draft.name.trim(),
    code: draft.code.trim(),
    qrCode: draft.qrCode.trim(),
    brand: draft.brand.trim(),
    model: draft.model.trim(),
    serialNumber: draft.serialNumber.trim(),
    powerKw: parsePowerKw(draft.powerKw),
    currentType: draft.currentType,
    socketType: draft.socketType,
    location: draft.location.trim(),
    status: draft.status,
    lastTestDate: normalizedLastTestDate
      ? dateOnlyToIsoDateTime(normalizedLastTestDate)
      : isEditMode
        ? null
        : undefined,
    notes: isEditMode ? trimToNull(draft.notes) : trimToUndefined(draft.notes),
    customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
  };
};

const mapApiStation = (station: ApiStation): Station => ({
  id: station.id,
  name: station.name,
  code: station.code,
  qrCode: station.qrCode,
  brand: station.brand,
  model: station.model,
  serialNumber: station.serialNumber,
  powerKw: station.powerKw,
  currentType: station.currentType,
  socketType: station.socketType,
  location: station.location,
  status: station.status,
  lastTestDate: station.lastTestDate,
  notes: station.notes ?? null,
  createdAt: station.createdAt ?? station.updatedAt,
  updatedAt: station.updatedAt,
  isArchived: station.isArchived,
  archivedAt: station.archivedAt,
  summary: station.summary,
  sync: station.sync,
  customFields: station.customFields ?? {},
});

const buildVisibleCustomFields = (
  station: ApiStation,
  definitions: CustomFieldDefinition[],
): Record<string, string> => {
  if (!station.customFields) {
    return {};
  }

  const visibleKeys = new Set(
    definitions
      .filter((definition) => definition.isActive && definition.isVisibleInList)
      .map((definition) => definition.key),
  );

  const visibleCustomFields: Record<string, string> = {};

  for (const [key, value] of Object.entries(station.customFields)) {
    if (!visibleKeys.has(key)) {
      continue;
    }

    visibleCustomFields[key] = formatCustomFieldValue(value);
  }

  return visibleCustomFields;
};

const buildCustomValueMap = (
  station: ApiStation,
  definitions: CustomFieldDefinition[],
): StationCustomValuesByFieldId => {
  const customValueMap: StationCustomValuesByFieldId = {};
  const definitionByKey = new Map(definitions.map((definition) => [definition.key, definition]));

  for (const [key, value] of Object.entries(station.customFields ?? {})) {
    const definition = definitionByKey.get(key);
    const fieldId = definition?.id ?? key;
    const formatted =
      definition?.type === 'date' ? isoToDateOnly(formatCustomFieldValue(value)) : formatCustomFieldValue(value);

    if (!formatted) {
      continue;
    }

    customValueMap[fieldId] = formatted;
  }

  return customValueMap;
};

const getStationSortOrder = (sortBy: StationListFilters['sortBy']): 'asc' | 'desc' => {
  if (sortBy === 'name') {
    return 'asc';
  }

  return 'desc';
};

const buildStationListQuery = async (
  filters: StationListFilters,
): Promise<StationListQuery> => {
  const definitions = await getCustomFieldDefinitions(true);
  const fieldKeyById = new Map(definitions.map((definition) => [definition.id, definition.key]));
  const query: StationListQuery = {
    search: filters.searchText.trim() || undefined,
    brand: filters.brand !== 'all' ? filters.brand : undefined,
    model: filters.model !== 'all' ? filters.model : undefined,
    currentType: filters.currentType !== 'all' ? filters.currentType : undefined,
    sortBy: filters.sortBy,
    sortOrder: getStationSortOrder(filters.sortBy),
    includeArchived: filters.status === 'archived',
    isArchived: filters.status === 'archived' ? true : undefined,
    status:
      filters.status !== 'all' && filters.status !== 'archived'
        ? filters.status
        : undefined,
  };

  for (const filter of filters.customFieldFilters) {
    const key = fieldKeyById.get(filter.fieldId);
    const value = filter.value.trim();

    if (!key || !value) {
      continue;
    }

    query[`cf.${key}`] = value;
  }

  return query;
};

const buildMetadataQuery = (
  filters: Partial<StationFilterMetadataFilters>,
): StationListQuery => {
  const query: StationListQuery = {
    search: filters.searchText?.trim() || undefined,
    currentType: filters.currentType && filters.currentType !== 'all' ? filters.currentType : undefined,
    includeArchived: filters.status === 'archived',
    isArchived: filters.status === 'archived' ? true : undefined,
    status:
      filters.status && filters.status !== 'all' && filters.status !== 'archived'
        ? filters.status
        : undefined,
    brand: filters.brand && filters.brand !== 'all' ? filters.brand : undefined,
  };

  return query;
};

const fetchStationPage = async (
  query: StationListQuery,
  page = 1,
): Promise<PaginatedResponse<ApiStation>> => {
  return apiFetch<PaginatedResponse<ApiStation>>('/stations', {
    query: {
      ...query,
      page,
      limit: DEFAULT_PAGE_SIZE,
      view: 'full',
    },
  });
};

const listAllStations = async (query: StationListQuery = {}): Promise<ApiStation[]> => {
  const firstPage = await fetchStationPage(query, 1);
  const stations = [...firstPage.data];

  for (let page = 2; page <= firstPage.meta.totalPages; page += 1) {
    const response = await fetchStationPage(query, page);
    stations.push(...response.data);
  }

  return stations;
};

export const getStationList = async (filters: StationListFilters): Promise<StationListItem[]> => {
  const [definitions, query] = await Promise.all([
    getCustomFieldDefinitions(true),
    buildStationListQuery(filters),
  ]);

  const stations = await listAllStations(query);

  return stations.map((station) => ({
    ...mapApiStation(station),
    visibleCustomFields: buildVisibleCustomFields(station, definitions),
  }));
};

export const getStationBrands = async (): Promise<string[]> => {
  const stations = await listAllStations({
    includeArchived: true,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return Array.from(new Set(stations.map((station) => station.brand))).sort((left, right) =>
    left.localeCompare(right),
  );
};

export const getStationModels = async (): Promise<string[]> => {
  const stations = await listAllStations({
    includeArchived: true,
    sortBy: 'name',
    sortOrder: 'asc',
  });

  return Array.from(new Set(stations.map((station) => station.model))).sort((left, right) =>
    left.localeCompare(right),
  );
};

export const getStationFilterOptions = async (
  filters: StationFilterMetadataFilters,
): Promise<{
  brands: string[];
  models: string[];
}> => {
  const [brandStations, modelStations] = await Promise.all([
    listAllStations({
      ...buildMetadataQuery({
        searchText: filters.searchText,
        status: filters.status,
        currentType: filters.currentType,
      }),
      sortBy: 'name',
      sortOrder: 'asc',
    }),
    listAllStations({
      ...buildMetadataQuery({
        searchText: filters.searchText,
        status: filters.status,
        currentType: filters.currentType,
        brand: filters.brand,
      }),
      sortBy: 'name',
      sortOrder: 'asc',
    }),
  ]);

  return {
    brands: Array.from(new Set(brandStations.map((station) => station.brand))).sort((left, right) =>
      left.localeCompare(right),
    ),
    models: Array.from(new Set(modelStations.map((station) => station.model))).sort((left, right) =>
      left.localeCompare(right),
    ),
  };
};

export const getStationById = async (stationId: string): Promise<StationDetails | null> => {
  try {
    const [response, definitions] = await Promise.all([
      apiFetch<SuccessResponse<ApiStation>>(`/stations/${stationId}`),
      getCustomFieldDefinitions(true),
    ]);

    return {
      ...mapApiStation(response.data),
      customValuesByFieldId: buildCustomValueMap(response.data, definitions),
    };
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }

    throw error;
  }
};

export const getStationByQrCode = async (qrCode: string): Promise<Station | null> => {
  const sanitized = qrCode.trim();

  if (!sanitized) {
    return null;
  }

  try {
    const response = await apiFetch<SuccessResponse<ApiStation>>(
      `/stations/lookup/qr/${encodeURIComponent(sanitized)}`,
    );

    return mapApiStation(response.data);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }

    throw error;
  }
};

export const upsertStation = async (
  draft: StationDraft,
  customValues: StationCustomValuesByFieldId,
): Promise<string> => {
  const payload = await buildStationUpsertPayload(draft, customValues);
  const response = draft.id
    ? await apiFetch<SuccessResponse<ApiStation>>(`/stations/${draft.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    : await apiFetch<SuccessResponse<ApiStation>>('/stations', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

  return response.data.id;
};

export const getDashboardMetrics = async (): Promise<{
  total: number;
  active: number;
  maintenance: number;
  inactive: number;
  faulty: number;
  archived: number;
}> => {
  const stations = await listAllStations({
    includeArchived: true,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  const counts = {
    total: stations.length,
    active: 0,
    maintenance: 0,
    inactive: 0,
    faulty: 0,
    archived: 0,
  };

  for (const station of stations) {
    if (station.isArchived) {
      counts.archived += 1;
      continue;
    }

    counts[station.status] += 1;
  }

  return counts;
};

export const getRecentlyUpdatedStations = async (limit = 5): Promise<Station[]> => {
  const response = await apiFetch<PaginatedResponse<ApiStation>>('/stations', {
    query: {
      includeArchived: true,
      sortBy: 'updatedAt',
      sortOrder: 'desc',
      page: 1,
      limit,
      view: 'full',
    },
  });

  return response.data.map(mapApiStation);
};

export const archiveStation = async (stationId: string): Promise<void> => {
  await apiFetch<SuccessResponse<ApiStation>>(`/stations/${stationId}/archive`, {
    method: 'POST',
  });
};

export const deleteStation = async (stationId: string): Promise<void> => {
  await apiFetch<SuccessResponse<{ success: boolean; id: string }>>(`/stations/${stationId}`, {
    method: 'DELETE',
  });
};
