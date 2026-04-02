import { apiFetch } from '@/lib/api/http';
import type {
  CustomFieldDefinition,
  CustomFieldDefinitionDraft,
  StationCustomValuesByFieldId,
} from '@/types';
import { normalizeCustomFieldKey } from '@/utils/custom-field';

type SuccessResponse<T> = {
  data: T;
};

const definitionCache = new Map<string, CustomFieldDefinition[]>();
const definitionRequestCache = new Map<string, Promise<CustomFieldDefinition[]>>();

type ApiCustomFieldDefinition = {
  id: string;
  key: string;
  label: string;
  type: CustomFieldDefinition['type'];
  options: Record<string, unknown>;
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleInList: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

const parseDraftOptions = (draft: CustomFieldDefinitionDraft): Record<string, unknown> | undefined => {
  if (draft.type !== 'select') {
    return undefined;
  }

  const trimmed = draft.optionsJson.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed)) {
    return undefined;
  }

  return {
    options: parsed.filter((item): item is string => typeof item === 'string'),
  };
};

const mapDefinition = (
  definition: ApiCustomFieldDefinition,
): CustomFieldDefinition => ({
  id: definition.id,
  key: definition.key,
  label: definition.label,
  type: definition.type,
  optionsJson:
    definition.type === 'select'
      ? JSON.stringify(
          Array.isArray(definition.options.options)
            ? definition.options.options.filter((item): item is string => typeof item === 'string')
            : [],
        )
      : null,
  isRequired: definition.isRequired,
  isFilterable: definition.isFilterable,
  isVisibleInList: definition.isVisibleInList,
  sortOrder: definition.sortOrder,
  isActive: definition.isActive,
});

const invalidateDefinitionCache = (): void => {
  definitionCache.clear();
  definitionRequestCache.clear();
};

export const getCustomFieldDefinitions = async (
  activeOnly = false,
  forceRefresh = false,
): Promise<CustomFieldDefinition[]> => {
  const cacheKey = activeOnly ? 'active' : 'all';

  if (!forceRefresh) {
    const cachedDefinitions = definitionCache.get(cacheKey);

    if (cachedDefinitions) {
      return cachedDefinitions;
    }

    const pendingRequest = definitionRequestCache.get(cacheKey);

    if (pendingRequest) {
      return pendingRequest;
    }
  }

  const request = apiFetch<SuccessResponse<ApiCustomFieldDefinition[]>>('/custom-fields', {
    query: activeOnly ? { isActive: true } : undefined,
  })
    .then((response) => response.data.map(mapDefinition))
    .then((definitions) => {
      definitionCache.set(cacheKey, definitions);
      definitionRequestCache.delete(cacheKey);
      return definitions;
    })
    .catch((error) => {
      definitionRequestCache.delete(cacheKey);
      throw error;
    });

  definitionRequestCache.set(cacheKey, request);
  return request;
};

export const getStationCustomValues = async (
  _stationId: string,
): Promise<StationCustomValuesByFieldId> => {
  return {};
};

export const upsertCustomFieldDefinition = async (
  draft: CustomFieldDefinitionDraft,
  existingId?: string,
): Promise<string> => {
  const payload = existingId
    ? {
        label: draft.label.trim(),
        type: draft.type,
        options: parseDraftOptions(draft),
        isRequired: draft.isRequired,
        isFilterable: draft.isFilterable,
        isVisibleInList: draft.isVisibleInList,
        sortOrder: draft.sortOrder,
      }
    : {
        key: normalizeCustomFieldKey(draft.key || draft.label),
        label: draft.label.trim(),
        type: draft.type,
        options: parseDraftOptions(draft),
        isRequired: draft.isRequired,
        isFilterable: draft.isFilterable,
        isVisibleInList: draft.isVisibleInList,
        sortOrder: draft.sortOrder,
        isActive: draft.isActive,
      };

  const response = existingId
    ? await apiFetch<SuccessResponse<ApiCustomFieldDefinition>>(
        `/custom-fields/${existingId}`,
        {
          method: 'PUT',
          body: JSON.stringify(payload),
        },
      )
    : await apiFetch<SuccessResponse<ApiCustomFieldDefinition>>(
        '/custom-fields',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
      );

  invalidateDefinitionCache();
  return response.data.id;
};

export const setCustomFieldActive = async (
  fieldId: string,
  isActive: boolean,
): Promise<void> => {
  await apiFetch<SuccessResponse<ApiCustomFieldDefinition>>(
    `/custom-fields/${fieldId}/active`,
    {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    },
  );
  invalidateDefinitionCache();
};

export const saveStationCustomValues = async (
  _stationId: string,
  _values: StationCustomValuesByFieldId,
): Promise<void> => {
  throw new Error('Station custom value sync is handled through backend station upsert flows.');
};
