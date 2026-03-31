import { AppError } from '../../utils/errors';
import { isUniqueViolation } from '../../utils/db-errors';
import { writeAuditLog } from '../../utils/audit-log';
import {
  normalizeOptionalMultilineText,
  normalizeOptionalSingleLineText,
  normalizeRequiredSingleLineText,
} from '../../utils/input';

import { customFieldsRepository, type CustomFieldsRepository } from './custom-fields.repository';

type Definition = Awaited<ReturnType<CustomFieldsRepository['findById']>>;

export class CustomFieldsService {
  constructor(private readonly repository: CustomFieldsRepository = customFieldsRepository) {}

  async list(active?: boolean) {
    return this.repository.list(active);
  }

  async create(
    userId: string,
    payload: {
      key: string;
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
      optionsJson?: Record<string, unknown>;
      isRequired?: boolean;
      isFilterable?: boolean;
      isVisibleInList?: boolean;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const normalizedKey = normalizeRequiredSingleLineText(payload.key, 'Custom field key', {
      collapseWhitespace: false,
      maxLength: 100,
      minLength: 2,
    }).toLowerCase();
    const normalizedLabel = normalizeRequiredSingleLineText(payload.label, 'Custom field label', {
      maxLength: 140,
      minLength: 2,
    });

    try {
      const created = await this.repository.create({
        key: normalizedKey,
        label: normalizedLabel,
        type: payload.type,
        optionsJson: payload.optionsJson ?? {},
        isRequired: payload.isRequired ?? false,
        isFilterable: payload.isFilterable ?? false,
        isVisibleInList: payload.isVisibleInList ?? false,
        sortOrder: payload.sortOrder ?? 0,
        isActive: payload.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      });

      await writeAuditLog({
        actorUserId: userId,
        entityType: 'custom_field_definition',
        entityId: created.id,
        action: 'custom_field.created',
        metadataJson: {
          key: created.key,
          type: created.type,
        },
      });

      return created;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AppError('Custom field key already exists', 409, 'CUSTOM_FIELD_KEY_EXISTS');
      }

      throw error;
    }
  }

  async update(
    userId: string,
    id: string,
    payload: {
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
      optionsJson?: Record<string, unknown>;
      isRequired: boolean;
      isFilterable: boolean;
      isVisibleInList: boolean;
      sortOrder: number;
    },
  ) {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new AppError('Custom field not found', 404, 'CUSTOM_FIELD_NOT_FOUND');
    }

    const normalizedLabel = normalizeRequiredSingleLineText(payload.label, 'Custom field label', {
      maxLength: 140,
      minLength: 2,
    });

    const updated = await this.repository.updateById(id, {
      label: normalizedLabel,
      type: payload.type,
      optionsJson: payload.optionsJson ?? existing.optionsJson,
      isRequired: payload.isRequired,
      isFilterable: payload.isFilterable,
      isVisibleInList: payload.isVisibleInList,
      sortOrder: payload.sortOrder,
      updatedBy: userId,
    });

    if (!updated) {
      throw new AppError('Custom field not found', 404, 'CUSTOM_FIELD_NOT_FOUND');
    }

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'custom_field_definition',
      entityId: updated.id,
      action: 'custom_field.updated',
    });

    return updated;
  }

  async setActive(userId: string, id: string, isActive: boolean) {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new AppError('Custom field not found', 404, 'CUSTOM_FIELD_NOT_FOUND');
    }

    const updated = await this.repository.updateById(id, {
      isActive,
      updatedBy: userId,
    });

    if (!updated) {
      throw new AppError('Custom field not found', 404, 'CUSTOM_FIELD_NOT_FOUND');
    }

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'custom_field_definition',
      entityId: updated.id,
      action: 'custom_field.active_changed',
      metadataJson: {
        isActive,
      },
    });

    return updated;
  }

  async getStationIdsByCustomFilters(filters: Record<string, string>) {
    const entries = Object.entries(filters);

    if (entries.length === 0) {
      return null;
    }

    let matchedIds: string[] | null = null;

    for (const [key, value] of entries) {
      const rows = await this.repository.getStationIdsByFilter(key, value);
      const stationIds = rows.map((row) => row.stationId);

      if (matchedIds === null) {
        matchedIds = stationIds;
      } else {
        const idSet = new Set(stationIds);
        matchedIds = matchedIds.filter((id) => idSet.has(id));
      }

      if (matchedIds.length === 0) {
        break;
      }
    }

    return matchedIds;
  }

  async getStationCustomFieldMap(stationIds: string[]) {
    const rows = await this.repository.getStationCustomFieldRows(stationIds);
    const map = new Map<string, Record<string, unknown>>();

    for (const row of rows) {
      const current = map.get(row.stationId) ?? {};
      current[row.key] = row.valueJson;
      map.set(row.stationId, current);
    }

    return map;
  }

  async upsertStationCustomFieldValues(stationId: string, customFields: Record<string, unknown>, executor?: any) {
    const keys = Object.keys(customFields);

    if (keys.length === 0) {
      return;
    }

    const definitions: NonNullable<Definition>[] = await this.repository.findByKeys(keys, executor);
    const definitionMap = new Map(definitions.map((definition) => [definition.key, definition]));

    for (const key of keys) {
      if (!definitionMap.has(key)) {
        throw new AppError(`Unknown custom field key: ${key}`, 400, 'CUSTOM_FIELD_UNKNOWN');
      }
    }

    for (const definition of definitions) {
      const value = customFields[definition.key];
      const normalizedValue = this.validateAndNormalizeCustomValue(definition, value);
      await this.repository.upsertStationFieldValue(stationId, definition.id, normalizedValue, executor);
    }
  }

  private validateAndNormalizeCustomValue(definition: NonNullable<Definition>, value: unknown) {
    if ((value === undefined || value === null || value === '') && definition.isRequired) {
      throw new AppError(`Custom field ${definition.key} is required`, 400, 'CUSTOM_FIELD_REQUIRED');
    }

    if (value === undefined) {
      return null;
    }

    switch (definition.type) {
      case 'text': {
        if (typeof value !== 'string') {
          throw new AppError(`Custom field ${definition.key} must be text`, 400, 'CUSTOM_FIELD_INVALID_TYPE');
        }

        return (
          normalizeOptionalMultilineText(value, `Custom field ${definition.key}`, {
            emptyAs: 'null',
            maxLength: 2000,
          }) ?? null
        );
      }
      case 'number': {
        if (typeof value !== 'number' || Number.isNaN(value)) {
          throw new AppError(`Custom field ${definition.key} must be a number`, 400, 'CUSTOM_FIELD_INVALID_TYPE');
        }

        return value;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') {
          throw new AppError(`Custom field ${definition.key} must be boolean`, 400, 'CUSTOM_FIELD_INVALID_TYPE');
        }

        return value;
      }
      case 'select': {
        if (typeof value !== 'string') {
          throw new AppError(`Custom field ${definition.key} must be text`, 400, 'CUSTOM_FIELD_INVALID_TYPE');
        }

        const normalizedValue =
          normalizeOptionalSingleLineText(value, `Custom field ${definition.key}`, {
            emptyAs: 'null',
            maxLength: 200,
          }) ?? null;

        if (normalizedValue === null) {
          return null;
        }

        const options = this.extractSelectOptions(definition.optionsJson);

        if (options.length > 0 && !options.includes(normalizedValue)) {
          throw new AppError(
            `Custom field ${definition.key} must be one of: ${options.join(', ')}`,
            400,
            'CUSTOM_FIELD_INVALID_OPTION',
          );
        }

        return normalizedValue;
      }
      case 'date': {
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          throw new AppError(`Custom field ${definition.key} must be a valid date string`, 400, 'CUSTOM_FIELD_INVALID_TYPE');
        }

        return value;
      }
      case 'json': {
        return value;
      }
      default: {
        throw new AppError('Unsupported custom field type', 400, 'CUSTOM_FIELD_UNSUPPORTED_TYPE');
      }
    }
  }

  private extractSelectOptions(optionsJson: Record<string, unknown>) {
    const optionsValue = optionsJson.options;

    if (!Array.isArray(optionsValue)) {
      return [];
    }

    return optionsValue.filter((item): item is string => typeof item === 'string');
  }
}

export const customFieldsService = new CustomFieldsService();
