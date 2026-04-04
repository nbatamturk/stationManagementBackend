import { getCustomFieldDefinitions } from '@/features/custom-fields';
import { isApiError } from '@/lib/api/errors';
import { apiFetch } from '@/lib/api/http';
import type {
  CustomFieldDefinition,
  Station,
  StationConfig,
  StationConnector,
  StationConnectorInput,
  StationCurrentType,
  StationCustomValuesByFieldId,
  StationDraft,
  StationListFilters,
  StationSummary,
  StationSync,
} from '@/types';
import { dateOnlyToIsoDateTime, isValidDateOnly, isoToDateOnly } from '@/utils/date';
import { parseSelectOptions } from '@/utils/custom-field';
import { deriveConnectorFields } from './helpers';

import type { StationFormRecord, StationListItem, StationListPage } from './types';

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

type ApiStationConnector = StationConnector;

type ApiStation = {
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
  status: Station['status'];
  lastTestDate: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  modelTemplateVersion: number | null;
  connectorSummary: Station['connectorSummary'];
  connectors?: ApiStationConnector[];
  customFields?: Record<string, unknown>;
  summary?: StationSummary;
  sync?: StationSync;
};

type StationListQuery = Record<string, string | number | boolean | undefined>;
type StationUpsertPayload = {
  name: string;
  code: string;
  qrCode: string;
  brandId: string;
  modelId: string;
  serialNumber: string;
  location: string;
  status: Station['status'];
  lastTestDate?: string | null;
  notes?: string | null;
  connectors: StationConnectorInput[];
  customFields?: Record<string, unknown>;
};

const DEFAULT_PAGE_SIZE = 20;

type StationFilterMetadataFilters = Pick<
  StationListFilters,
  'brand' | 'currentType' | 'model' | 'searchText' | 'status'
>;

let stationConfigCache: StationConfig | null = null;
let stationConfigRequest: Promise<StationConfig> | null = null;

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

const parseConnectorPayload = (draft: StationDraft): StationConnectorInput[] => {
  if (draft.connectors.length === 0) {
    throw new Error('At least one connector is required.');
  }

  const usedConnectorNumbers = new Set<number>();

  return draft.connectors.map((connector, index) => {
    const connectorNo = Number(connector.connectorNo.trim());
    const powerKw = Number(connector.powerKw.trim());

    if (!Number.isInteger(connectorNo) || connectorNo < 1) {
      throw new Error(`Connector ${index + 1}: connector number must be at least 1.`);
    }

    if (usedConnectorNumbers.has(connectorNo)) {
      throw new Error(`Connector number ${connectorNo} is duplicated.`);
    }

    usedConnectorNumbers.add(connectorNo);

    if (!Number.isFinite(powerKw) || powerKw <= 0) {
      throw new Error(`Connector ${index + 1}: power must be a valid number greater than 0.`);
    }

    return {
      connectorNo,
      connectorType: connector.connectorType,
      currentType: connector.currentType,
      powerKw,
      isActive: connector.isActive,
      sortOrder: index + 1,
    };
  });
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
    brandId: draft.brandId,
    modelId: draft.modelId,
    serialNumber: draft.serialNumber.trim(),
    location: draft.location.trim(),
    status: draft.status,
    lastTestDate: normalizedLastTestDate
      ? dateOnlyToIsoDateTime(normalizedLastTestDate)
      : isEditMode
        ? null
        : undefined,
    notes: isEditMode ? trimToNull(draft.notes) : trimToUndefined(draft.notes),
    connectors: parseConnectorPayload(draft),
    customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
  };
};

const mapApiConnector = (connector: ApiStationConnector): StationConnector => ({
  id: connector.id,
  connectorNo: connector.connectorNo,
  connectorType: connector.connectorType,
  currentType: connector.currentType,
  powerKw: connector.powerKw,
  isActive: connector.isActive,
  sortOrder: connector.sortOrder,
});

const mapApiStation = (station: ApiStation): Station => ({
  id: station.id,
  name: station.name,
  code: station.code,
  qrCode: station.qrCode,
  brandId: station.brandId,
  modelId: station.modelId,
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
  modelTemplateVersion: station.modelTemplateVersion,
  connectorSummary: station.connectorSummary,
  connectors: station.connectors?.map(mapApiConnector),
  summary: station.summary,
  sync: station.sync,
  customFields: station.customFields ?? {},
});

const mapApiStationListItem = (station: ApiStation): StationListItem => ({
  id: station.id,
  name: station.name,
  code: station.code,
  location: station.location,
  brandId: station.brandId,
  modelId: station.modelId,
  brand: station.brand,
  model: station.model,
  powerKw: station.powerKw,
  currentType: station.currentType,
  status: station.status,
  lastTestDate: station.lastTestDate,
  updatedAt: station.updatedAt,
  isArchived: station.isArchived,
  archivedAt: station.archivedAt,
  modelTemplateVersion: station.modelTemplateVersion,
  connectorSummary: station.connectorSummary,
  summary: station.summary ?? {
    totalIssueCount: 0,
    openIssueCount: 0,
    hasOpenIssues: false,
    attachmentCount: 0,
    testHistoryCount: 0,
    latestTestResult: null,
  },
});

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

const fetchStationPage = async (
  query: StationListQuery,
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
  view: 'compact' | 'full' = 'full',
): Promise<PaginatedResponse<ApiStation>> => {
  return apiFetch<PaginatedResponse<ApiStation>>('/stations', {
    query: {
      ...query,
      page,
      limit,
      view,
    },
  });
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
  };

  return query;
};

export const clearStationConfigCache = (): void => {
  stationConfigCache = null;
  stationConfigRequest = null;
};

export const getStationConfig = async (forceRefresh = false): Promise<StationConfig> => {
  if (!forceRefresh && stationConfigCache) {
    return stationConfigCache;
  }

  if (!forceRefresh && stationConfigRequest) {
    return stationConfigRequest;
  }

  const request = apiFetch<SuccessResponse<StationConfig>>('/stations/config')
    .then((response) => {
      stationConfigCache = response.data;
      stationConfigRequest = null;
      return response.data;
    })
    .catch((error) => {
      stationConfigRequest = null;
      throw error;
    });

  stationConfigRequest = request;
  return request;
};

export const getStationFilterOptions = async (
  filters: StationFilterMetadataFilters,
): Promise<{
  brands: string[];
  models: string[];
}> => {
  const config = await getStationConfig();
  const activeBrands = config.brands
    .filter((brand) => brand.isActive)
    .sort((left, right) => left.name.localeCompare(right.name));
  const selectedBrand =
    filters.brand !== 'all'
      ? activeBrands.find((brand) => brand.name === filters.brand) ??
        config.brands.find((brand) => brand.name === filters.brand) ??
        null
      : null;
  const activeModels = config.models
    .filter((model) => model.isActive)
    .filter((model) => !selectedBrand || model.brandId === selectedBrand.id)
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    brands: activeBrands.map((brand) => brand.name),
    models: Array.from(new Set(activeModels.map((model) => model.name))),
  };
};

export const getStationList = async (
  filters: StationListFilters,
  page = 1,
  limit = DEFAULT_PAGE_SIZE,
): Promise<StationListPage> => {
  const query = await buildStationListQuery(filters);
  const response = await fetchStationPage(query, page, limit, 'compact');

  return {
    items: response.data.map(mapApiStationListItem),
    meta: response.meta,
    hasMore: response.meta.page < response.meta.totalPages,
  };
};

export const getStationById = async (stationId: string): Promise<Station | null> => {
  try {
    const response = await apiFetch<SuccessResponse<ApiStation>>(`/stations/${stationId}`);
    return mapApiStation(response.data);
  } catch (error) {
    if (isApiError(error) && error.status === 404) {
      return null;
    }

    throw error;
  }
};

export const getStationByIdForForm = async (stationId: string): Promise<StationFormRecord | null> => {
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

export const applyStationModelTemplate = async (stationId: string): Promise<Station> => {
  const response = await apiFetch<SuccessResponse<ApiStation>>(`/stations/${stationId}/apply-model-template`, {
    method: 'POST',
  });

  return mapApiStation(response.data);
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

export const getDashboardSummary = async (): Promise<{
  totalStations: number;
  activeStations: number;
  archivedStations: number;
  maintenanceStations: number;
  faultyStations: number;
  totalOpenIssues: number;
  totalCriticalIssues: number;
  recentTestCount: number;
}> => {
  const response = await apiFetch<
    SuccessResponse<{
      totalStations: number;
      activeStations: number;
      archivedStations: number;
      maintenanceStations: number;
      faultyStations: number;
      totalOpenIssues: number;
      totalCriticalIssues: number;
      recentTestCount: number;
    }>
  >('/dashboard/summary');

  return response.data;
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

export const getDerivedStationFields = (connectors: StationConnectorInput[] | StationConnector[]) =>
  deriveConnectorFields(connectors);

export const getStationMetadataQuery = (filters: Partial<StationFilterMetadataFilters>) =>
  buildMetadataQuery(filters);
