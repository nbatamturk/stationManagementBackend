import { db } from '../../db/client';
import { AppError } from '../../utils/errors';
import { isUniqueViolation } from '../../utils/db-errors';
import { writeAuditLog } from '../../utils/audit-log';
import {
  normalizeOptionalObject,
  normalizeOptionalMultilineText,
  normalizeOptionalSingleLineText,
  normalizeRequiredFiniteNumber,
  normalizeRequiredSingleLineText,
} from '../../utils/input';

import { customFieldsRepository, type CustomFieldsRepository } from './custom-fields.repository';

type Definition = Awaited<ReturnType<CustomFieldsRepository['findById']>>;
type DefinitionRecord = NonNullable<Definition>;
type DefinitionResponse = {
  id: string;
  key: string;
  label: string;
  type: DefinitionRecord['type'];
  options: Record<string, unknown>;
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleInList: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class CustomFieldsService {
  constructor(private readonly repository: CustomFieldsRepository = customFieldsRepository) {}

  async list(active?: boolean): Promise<DefinitionResponse[]> {
    const definitions = await this.repository.list(active);
    return definitions.map((definition) => this.toDefinitionResponse(definition));
  }

  async listDefinitions(active?: boolean): Promise<DefinitionRecord[]> {
    return this.repository.list(active);
  }

  async create(
    userId: string,
    payload: {
      key: string;
      label: string;
      type: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
      options?: Record<string, unknown>;
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
    const normalizedOptions = this.normalizeDefinitionOptions(payload.type, payload.options);
    const sortOrder = normalizeRequiredFiniteNumber(payload.sortOrder ?? 0, 'Custom field sort order', {
      integer: true,
      maximum: 10_000,
      minimum: 0,
    });

    try {
      const created = await this.repository.create({
        key: normalizedKey,
        label: normalizedLabel,
        type: payload.type,
        optionsJson: normalizedOptions,
        isRequired: payload.isRequired ?? false,
        isFilterable: payload.isFilterable ?? false,
        isVisibleInList: payload.isVisibleInList ?? false,
        sortOrder,
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

      return this.toDefinitionResponse(created);
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
      options?: Record<string, unknown>;
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
    const normalizedOptions = this.normalizeDefinitionOptions(payload.type, payload.options ?? existing.optionsJson);
    const sortOrder = normalizeRequiredFiniteNumber(payload.sortOrder, 'Custom field sort order', {
      integer: true,
      maximum: 10_000,
      minimum: 0,
    });

    await this.assertDefinitionUpdateIsSafe(existing, payload.type, normalizedOptions);

    const updated = await this.repository.updateById(id, {
      label: normalizedLabel,
      type: payload.type,
      optionsJson: normalizedOptions,
      isRequired: payload.isRequired,
      isFilterable: payload.isFilterable,
      isVisibleInList: payload.isVisibleInList,
      sortOrder,
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

    return this.toDefinitionResponse(updated);
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

    return this.toDefinitionResponse(updated);
  }

  async delete(userId: string, id: string) {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new AppError('Custom field not found', 404, 'CUSTOM_FIELD_NOT_FOUND');
    }

    const existingValueCount = await this.repository.countStationValuesByDefinitionId(id);

    await db.transaction(async (tx) => {
      const deleted = await this.repository.deleteById(id, tx);

      if (!deleted) {
        throw new AppError('Custom field not found', 404, 'CUSTOM_FIELD_NOT_FOUND');
      }

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'custom_field_definition',
          entityId: id,
          action: 'custom_field.deleted',
          metadataJson: {
            key: existing.key,
            removedStationValueCount: existingValueCount,
          },
        },
        tx,
      );
    });

    return {
      success: true as const,
      id,
    };
  }

  async getStationIdsByCustomFilters(filters: Record<string, string>) {
    const entries = Object.entries(filters);

    if (entries.length === 0) {
      return null;
    }

    const definitions: DefinitionRecord[] = await this.repository.findByKeys(
      entries.map(([key]) => key),
    );
    const definitionMap = new Map(definitions.map((definition) => [definition.key, definition]));

    let matchedIds: string[] | null = null;

    for (const [key, value] of entries) {
      const definition = definitionMap.get(key);

      if (!definition || !definition.isActive || !definition.isFilterable) {
        throw new AppError(`Custom field filter is not allowed for ${key}`, 400, 'INVALID_FILTER');
      }

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
      current[row.key] = this.normalizeStoredCustomValue(row.type, row.valueJson);
      map.set(row.stationId, current);
    }

    return map;
  }

  async upsertStationCustomFieldValues(
    stationId: string,
    customFields: Record<string, unknown>,
    executor?: any,
    options?: {
      enforceRequiredDefinitions?: boolean;
    },
  ) {
    const keys = Object.keys(customFields);
    const shouldEnforceRequiredDefinitions = options?.enforceRequiredDefinitions ?? false;

    if (shouldEnforceRequiredDefinitions) {
      const requiredDefinitions: NonNullable<Definition>[] = await this.repository.listActiveRequired(executor);
      const missingRequiredKeys = requiredDefinitions
        .map((definition) => definition.key)
        .filter((key) => !keys.includes(key));

      if (missingRequiredKeys.length > 0) {
        throw new AppError('Missing required custom fields', 400, 'CUSTOM_FIELD_REQUIRED', {
          missingKeys: missingRequiredKeys,
        });
      }
    }

    if (keys.length === 0) {
      return;
    }

    const definitions: NonNullable<Definition>[] = await this.repository.findByKeys(keys, executor);
    const definitionMap = new Map(definitions.map((definition) => [definition.key, definition]));

    for (const key of keys) {
      if (!definitionMap.has(key)) {
        throw new AppError(`Unknown custom field key: ${key}`, 400, 'CUSTOM_FIELD_UNKNOWN');
      }

      if (!definitionMap.get(key)?.isActive) {
        throw new AppError(`Custom field ${key} is inactive`, 400, 'CUSTOM_FIELD_INACTIVE');
      }
    }

    for (const definition of definitions) {
      const value = customFields[definition.key];
      const normalizedValue = this.validateAndNormalizeCustomValue(definition, value);

      if (normalizedValue === null) {
        await this.repository.deleteStationFieldValue(stationId, definition.id, executor);
        continue;
      }

      await this.repository.upsertStationFieldValue(stationId, definition.id, normalizedValue, executor);
    }
  }

  private validateAndNormalizeCustomValue(definition: NonNullable<Definition>, value: unknown) {
    if (this.isEmptyCustomValue(value) && definition.isRequired) {
      throw new AppError(`Custom field ${definition.key} is required`, 400, 'CUSTOM_FIELD_REQUIRED');
    }

    if (this.isEmptyCustomValue(value)) {
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
        if (typeof value !== 'number' || !Number.isFinite(value)) {
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
            'CUSTOM_FIELD_INVALID_OPTIONS',
          );
        }

        return normalizedValue;
      }
      case 'date': {
        if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
          throw new AppError(`Custom field ${definition.key} must be a valid date string`, 400, 'CUSTOM_FIELD_INVALID_TYPE');
        }

        return new Date(value).toISOString();
      }
      case 'json': {
        return value;
      }
      default: {
        throw new AppError('Unsupported custom field type', 400, 'CUSTOM_FIELD_UNSUPPORTED_TYPE');
      }
    }
  }

  private async assertDefinitionUpdateIsSafe(
    existing: DefinitionRecord,
    nextType: DefinitionRecord['type'],
    nextOptions: Record<string, unknown>,
  ) {
    if (existing.type !== nextType) {
      const existingValueCount = await this.repository.countStationValuesByDefinitionId(existing.id);

      if (existingValueCount > 0) {
        throw new AppError(
          'Custom field type cannot be changed while station values exist',
          400,
          'CUSTOM_FIELD_TYPE_CHANGE_FORBIDDEN',
        );
      }

      return;
    }

    if (nextType !== 'select') {
      return;
    }

    const currentOptions = this.extractSelectOptions(existing.optionsJson);
    const nextSelectOptions = this.extractSelectOptions(nextOptions);

    if (
      currentOptions.length === nextSelectOptions.length &&
      currentOptions.every((option, index) => option === nextSelectOptions[index])
    ) {
      return;
    }

    const storedValues = await this.repository.listStationValuesByDefinitionId(existing.id);
    const invalidInUseValues = Array.from(
      new Set(
        storedValues
          .map((row: { valueJson: unknown }) => row.valueJson)
          .filter((value: unknown): value is string => typeof value === 'string' && !nextSelectOptions.includes(value)),
      ),
    );

    if (invalidInUseValues.length > 0) {
      throw new AppError(
        'Select custom field options cannot remove values used by stations',
        400,
        'CUSTOM_FIELD_INVALID_OPTIONS',
        {
          inUseValues: invalidInUseValues,
        },
      );
    }
  }

  private isEmptyCustomValue(value: unknown) {
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  }

  private extractSelectOptions(optionsJson: Record<string, unknown>) {
    const optionsValue = optionsJson.options;

    if (!Array.isArray(optionsValue)) {
      return [];
    }

    return optionsValue.filter((item): item is string => typeof item === 'string');
  }

  private normalizeDefinitionOptions(type: DefinitionRecord['type'], value: unknown) {
    const normalizedOptions = normalizeOptionalObject(value, 'Custom field options', {
      maxKeys: 20,
    });
    const options = normalizedOptions ?? {};

    if (type !== 'select') {
      return options;
    }

    const rawOptions = options.options;

    if (!Array.isArray(rawOptions) || rawOptions.length === 0) {
      throw new AppError(
        'Select custom fields must define a non-empty options array',
        400,
        'CUSTOM_FIELD_INVALID_OPTIONS',
      );
    }

    const normalizedSelectOptions = Array.from(
      new Set(
        rawOptions.map((option) => {
          if (typeof option !== 'string') {
            throw new AppError('Select custom field options must be strings', 400, 'CUSTOM_FIELD_INVALID_OPTIONS');
          }

          return normalizeRequiredSingleLineText(option, 'Custom field option', {
            maxLength: 200,
            minLength: 1,
          });
        }),
      ),
    );

    if (normalizedSelectOptions.length !== rawOptions.length) {
      throw new AppError('Select custom field options must be unique', 400, 'CUSTOM_FIELD_INVALID_OPTIONS');
    }

    return {
      ...options,
      options: normalizedSelectOptions,
    };
  }

  private normalizeStoredCustomValue(type: DefinitionRecord['type'], value: unknown) {
    if (type === 'date' && typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
      return new Date(value).toISOString();
    }

    return value;
  }

  private toDefinitionResponse(definition: DefinitionRecord): DefinitionResponse {
    return {
      id: definition.id,
      key: definition.key,
      label: definition.label,
      type: definition.type,
      options: definition.optionsJson,
      isRequired: definition.isRequired,
      isFilterable: definition.isFilterable,
      isVisibleInList: definition.isVisibleInList,
      sortOrder: definition.sortOrder,
      isActive: definition.isActive,
      createdAt: definition.createdAt,
      updatedAt: definition.updatedAt,
    };
  }
}

export const customFieldsService = new CustomFieldsService();
