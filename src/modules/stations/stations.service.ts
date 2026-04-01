import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stations, type CurrentType, type SocketType, type StationStatus } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { getPgError, isUniqueViolation } from '../../utils/db-errors';
import { AppError } from '../../utils/errors';
import {
  normalizeOptionalDateTime,
  normalizeOptionalFiniteNumber,
  normalizeOptionalObject,
  normalizeOptionalMultilineText,
  normalizeOptionalSingleLineText,
  normalizeRequiredFiniteNumber,
  normalizeRequiredSingleLineText,
} from '../../utils/input';

import { attachmentsService } from '../attachments/attachments.service';
import { customFieldsService, type CustomFieldsService } from '../custom-fields/custom-fields.service';
import {
  stationsRepository,
  type StationListFilter,
  type StationMobileSummary,
  type StationsRepository,
} from './stations.repository';

type StationRecord = Awaited<ReturnType<StationsRepository['findById']>>;
type StationCommonResponse = {
  id: string;
  name: string;
  code: string;
  qrCode: string;
  brand: string;
  model: string;
  powerKw: number;
  currentType: CurrentType;
  socketType: SocketType;
  location: string;
  status: StationStatus;
  lastTestDate: Date | null;
  isArchived: boolean;
  archivedAt: Date | null;
  updatedAt: Date;
};
type StationSyncMetadata = {
  updatedAt: Date;
  isArchived: boolean;
  archivedAt: Date | null;
  isDeleted: false;
  deletedAt: null;
  deletionMode: 'hard_delete';
  conflictFields?: typeof STATION_CONFLICT_FIELDS;
};
type StationCompactResponse = StationCommonResponse & {
  summary: StationMobileSummary;
  sync: StationSyncMetadata;
};
type StationSummaryResponse = StationCompactResponse & {
  serialNumber: string;
};
type StationFullListItemResponse = StationCompactResponse & {
  serialNumber: string;
  notes: string | null;
  createdAt: Date;
  customFields: Record<string, unknown>;
};
type StationDetailResponse = StationSummaryResponse & {
  notes: string | null;
  createdAt: Date;
  customFields: Record<string, unknown>;
};
type StationListItemResponse = StationFullListItemResponse | StationCompactResponse;
type StationListResult<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type StationCreatePayload = {
  name: string;
  code: string;
  qrCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: number;
  currentType: CurrentType;
  socketType: SocketType;
  location: string;
  status?: StationStatus;
  lastTestDate?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
};

type StationUpdatePayload = Partial<StationCreatePayload>;

type StationListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  code?: string;
  qrCode?: string;
  ids?: string | string[];
  status?: StationStatus;
  brand?: string;
  currentType?: CurrentType;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastTestDate' | 'powerKw';
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
  isArchived?: boolean;
  createdFrom?: string;
  createdTo?: string;
  updatedFrom?: string;
  updatedTo?: string;
  powerMin?: number;
  powerMax?: number;
  view?: 'full' | 'compact';
} & Record<string, unknown>;

const allowedQueryKeys = new Set([
  'page',
  'limit',
  'search',
  'code',
  'qrCode',
  'ids',
  'status',
  'brand',
  'currentType',
  'sortBy',
  'sortOrder',
  'includeArchived',
  'isArchived',
  'createdFrom',
  'createdTo',
  'updatedFrom',
  'updatedTo',
  'powerMin',
  'powerMax',
  'view',
]);

const CUSTOM_FILTER_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_CUSTOM_FILTERS = 20;
const MAX_ID_FILTERS = 100;
const STATION_CONFLICT_FIELDS = ['status', 'location', 'lastTestDate', 'notes', 'customFields', 'attachments', 'issues'] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_STATION_POWER_KW = 1000;

export class StationsService {
  constructor(
    private readonly repository: StationsRepository = stationsRepository,
    private readonly cfService: CustomFieldsService = customFieldsService,
  ) {}

  async list(query: StationListQuery): Promise<StationListResult<StationListItemResponse>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const view = query.view ?? 'full';
    const normalizedSearch =
      normalizeOptionalSingleLineText(query.search, 'Search', {
        maxLength: 120,
      }) ?? undefined;
    const normalizedCode =
      normalizeOptionalSingleLineText(query.code, 'Station code', {
        maxLength: 80,
      }) ?? undefined;
    const normalizedQrCode =
      normalizeOptionalSingleLineText(query.qrCode, 'QR code', {
        maxLength: 150,
      }) ?? undefined;
    const normalizedBrand =
      normalizeOptionalSingleLineText(query.brand, 'Brand', {
        maxLength: 120,
      }) ?? undefined;
    const ids = this.parseIdsFilter(query.ids);

    const createdFrom = normalizeOptionalDateTime(query.createdFrom, 'Created from', { allowFuture: true });
    const createdTo = normalizeOptionalDateTime(query.createdTo, 'Created to', { allowFuture: true });
    const updatedFrom = normalizeOptionalDateTime(query.updatedFrom, 'Updated from', { allowFuture: true });
    const updatedTo = normalizeOptionalDateTime(query.updatedTo, 'Updated to', { allowFuture: true });
    const powerMin = normalizeOptionalFiniteNumber(query.powerMin, 'Power minimum', {
      maximum: MAX_STATION_POWER_KW,
      minimum: 0,
    });
    const powerMax = normalizeOptionalFiniteNumber(query.powerMax, 'Power maximum', {
      maximum: MAX_STATION_POWER_KW,
      minimum: 0,
    });

    this.assertDateRange('Created', createdFrom, createdTo);
    this.assertDateRange('Updated', updatedFrom, updatedTo);
    this.assertNumericRange('Power', powerMin, powerMax);

    const customFieldFilters = await this.extractCustomFieldFilters(query);
    const customFilteredStationIds = await this.cfService.getStationIdsByCustomFilters(customFieldFilters);

    const listFilters: StationListFilter = {
      page,
      limit,
      search: normalizedSearch,
      ids,
      code: normalizedCode,
      qrCode: normalizedQrCode,
      status: query.status,
      brand: normalizedBrand,
      currentType: query.currentType,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      includeArchived: query.includeArchived,
      isArchived: query.isArchived,
      createdFrom: createdFrom ?? undefined,
      createdTo: createdTo ?? undefined,
      updatedFrom: updatedFrom ?? undefined,
      updatedTo: updatedTo ?? undefined,
      powerMin,
      powerMax,
      customFilteredStationIds,
    };

    const { rows, total } = await this.repository.list(listFilters);

    if (rows.length === 0) {
      return {
        data: [],
        meta: {
          page,
          limit,
          total,
          totalPages: 0,
        },
      };
    }

    const [summaryMap, customFieldMap] = await Promise.all([
      this.repository.getMobileSummaryMap(rows.map((row) => row.id)),
      view === 'compact' ? Promise.resolve(new Map<string, Record<string, unknown>>()) : this.cfService.getStationCustomFieldMap(rows.map((row) => row.id)),
    ]);

    if (view === 'compact') {
      return {
        data: rows.map((row) => this.toStationCompactResponse(row, summaryMap.get(row.id))),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    return {
      data: rows.map((row) => this.toStationListResponse(row, customFieldMap.get(row.id) ?? {}, summaryMap.get(row.id))),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private assertDateRange(label: string, from?: Date | null, to?: Date | null) {
    if (!from || !to) {
      return;
    }

    if (from > to) {
      throw new AppError(`${label} from date must be less than or equal to to date`, 400, 'INVALID_FILTER');
    }
  }

  private assertNumericRange(label: string, min?: number, max?: number) {
    if (min === undefined || max === undefined) {
      return;
    }

    if (min > max) {
      throw new AppError(`${label} minimum must be less than or equal to maximum`, 400, 'INVALID_FILTER');
    }
  }

  async getById(id: string) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    const [customFieldMap, summaryMap] = await Promise.all([
      this.cfService.getStationCustomFieldMap([id]),
      this.repository.getMobileSummaryMap([id]),
    ]);

    return this.toStationDetailResponse(station, customFieldMap.get(id) ?? {}, summaryMap.get(id));
  }

  async getSummaryById(id: string) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    const summaryMap = await this.repository.getMobileSummaryMap([id]);
    return this.toStationSummaryResponse(station, summaryMap.get(id));
  }

  async lookupByQrCode(qrCode: string) {
    const normalizedQrCode =
      normalizeOptionalSingleLineText(qrCode, 'QR code', {
        maxLength: 150,
      }) ?? undefined;

    if (!normalizedQrCode) {
      throw new AppError('QR code is required', 400, 'INVALID_QR_CODE');
    }

    const station = await this.repository.findByQrCode(normalizedQrCode);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    const summaryMap = await this.repository.getMobileSummaryMap([station.id]);
    return this.toStationSummaryResponse(station, summaryMap.get(station.id));
  }

  async listFull(query: StationListQuery): Promise<StationListResult<StationFullListItemResponse>> {
    const result = await this.list({
      ...query,
      view: 'full',
    });

    return {
      data: result.data.map((item) => {
        if (
          !('serialNumber' in item) ||
          item.serialNumber === undefined ||
          !('notes' in item) ||
          item.notes === undefined ||
          !('createdAt' in item) ||
          item.createdAt === undefined ||
          !('customFields' in item) ||
          item.customFields === undefined
        ) {
          throw new Error('Expected full station list item');
        }

        return {
          ...item,
          serialNumber: item.serialNumber,
          notes: item.notes,
          createdAt: item.createdAt,
          customFields: item.customFields,
        };
      }),
      meta: result.meta,
    };
  }

  async create(userId: string, payload: StationCreatePayload) {
    const normalizedPayload = this.normalizeCreatePayload(payload);

    try {
      const stationId = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(stations)
          .values({
            name: normalizedPayload.name,
            code: normalizedPayload.code,
            qrCode: normalizedPayload.qrCode,
            brand: normalizedPayload.brand,
            model: normalizedPayload.model,
            serialNumber: normalizedPayload.serialNumber,
            powerKw: normalizedPayload.powerKw.toString(),
            currentType: normalizedPayload.currentType,
            socketType: normalizedPayload.socketType,
            location: normalizedPayload.location,
            status: normalizedPayload.status ?? 'active',
            lastTestDate: normalizedPayload.lastTestDate ? new Date(normalizedPayload.lastTestDate) : undefined,
            notes: normalizedPayload.notes,
            isArchived: false,
            archivedAt: undefined,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: stations.id });

        if (!created) {
          throw new Error('Failed to create station');
        }

        await this.cfService.upsertStationCustomFieldValues(created.id, normalizedPayload.customFields ?? {}, tx, {
          enforceRequiredDefinitions: true,
        });

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station',
            entityId: created.id,
            action: 'station.created',
          },
          tx,
        );

        return created.id;
      });

      return this.getById(stationId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw this.mapStationUniqueConstraintError(getPgError(error) ?? {});
      }

      throw error;
    }
  }

  async update(userId: string, id: string, payload: StationUpdatePayload) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    const normalizedPayload = this.normalizeUpdatePayload(payload);
    const hasCustomFieldUpdates =
      normalizedPayload.customFields !== undefined && Object.keys(normalizedPayload.customFields).length > 0;
    const hasStationFieldUpdates = [
      normalizedPayload.name,
      normalizedPayload.code,
      normalizedPayload.qrCode,
      normalizedPayload.brand,
      normalizedPayload.model,
      normalizedPayload.serialNumber,
      normalizedPayload.powerKw,
      normalizedPayload.currentType,
      normalizedPayload.socketType,
      normalizedPayload.location,
      normalizedPayload.status,
      normalizedPayload.lastTestDate,
      normalizedPayload.notes,
    ].some((value) => value !== undefined);

    if (!hasStationFieldUpdates && !hasCustomFieldUpdates) {
      return this.getById(id);
    }

    if (station.isArchived && normalizedPayload.status && normalizedPayload.status !== 'inactive') {
      throw new AppError('Archived stations must use inactive status', 400, 'INVALID_STATION_STATUS');
    }

    try {
      await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(stations)
          .set({
            name: normalizedPayload.name,
            code: normalizedPayload.code,
            qrCode: normalizedPayload.qrCode,
            brand: normalizedPayload.brand,
            model: normalizedPayload.model,
            serialNumber: normalizedPayload.serialNumber,
            powerKw: normalizedPayload.powerKw !== undefined ? normalizedPayload.powerKw.toString() : undefined,
            currentType: normalizedPayload.currentType,
            socketType: normalizedPayload.socketType,
            location: normalizedPayload.location,
            status: normalizedPayload.status,
            lastTestDate: normalizedPayload.lastTestDate ? new Date(normalizedPayload.lastTestDate) : undefined,
            notes: normalizedPayload.notes,
            isArchived: station.isArchived,
            archivedAt: station.archivedAt,
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(stations.id, id))
          .returning({ id: stations.id });

        if (!updated) {
          throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
        }

        if (normalizedPayload.customFields) {
          await this.cfService.upsertStationCustomFieldValues(id, normalizedPayload.customFields, tx);
        }

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station',
            entityId: id,
            action: 'station.updated',
          },
          tx,
        );
      });

      return this.getById(id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw this.mapStationUniqueConstraintError(getPgError(error) ?? {});
      }

      throw error;
    }
  }

  async delete(userId: string, id: string) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    const deletedAttachments = await db.transaction(async (tx) => {
      const removedAttachments = await attachmentsService.deleteByStationId(userId, id, tx);
      const [deleted] = await tx.delete(stations).where(eq(stations.id, id)).returning({ id: stations.id });

      if (!deleted) {
        throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
      }

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'station',
          entityId: id,
          action: 'station.deleted',
        },
        tx,
      );

      return removedAttachments;
    });

    await attachmentsService.cleanupStoredFiles(deletedAttachments);

    return {
      success: true,
      id,
    };
  }

  async archive(userId: string, id: string) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    await db.transaction(async (tx) => {
      const [archived] = await tx
        .update(stations)
        .set({
          status: 'inactive',
          isArchived: true,
          archivedAt: station.archivedAt ?? new Date(),
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(stations.id, id))
        .returning({ id: stations.id });

      if (!archived) {
        throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
      }

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'station',
          entityId: id,
          action: 'station.archived',
        },
        tx,
      );
    });

    return this.getById(id);
  }

  async ensureExists(id: string) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    return station;
  }

  async updateLastTestDate(stationId: string, testDate: Date | null) {
    await this.repository.updateLastTestDate(stationId, testDate);
  }

  private async extractCustomFieldFilters(query: StationListQuery): Promise<Record<string, string>> {
    const filters: Record<string, string> = {};

    for (const [key, rawValue] of Object.entries(query)) {
      if (allowedQueryKeys.has(key)) {
        continue;
      }

      if (!key.startsWith('cf.')) {
        throw new AppError(`Unknown filter parameter: ${key}`, 400, 'INVALID_FILTER');
      }

      const customFieldKey = key.slice(3);

      if (!customFieldKey || !CUSTOM_FILTER_KEY_PATTERN.test(customFieldKey)) {
        throw new AppError('Custom filter key is empty', 400, 'INVALID_FILTER');
      }

      const value = this.normalizeFilterValue(rawValue);

      if (!value) {
        throw new AppError(`Custom filter value is invalid for ${key}`, 400, 'INVALID_FILTER');
      }

      filters[customFieldKey] = value;
    }

    if (Object.keys(filters).length > MAX_CUSTOM_FILTERS) {
      throw new AppError('Too many custom filters provided', 400, 'INVALID_FILTER');
    }

    return filters;
  }

  private normalizeFilterValue(value: unknown): string {
    const normalizeValue = (input: string) =>
      normalizeOptionalSingleLineText(input, 'Custom filter value', {
        maxLength: 255,
      }) ?? '';

    if (typeof value === 'string') {
      return normalizeValue(value);
    }

    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === 'string');
      return typeof first === 'string' ? normalizeValue(first) : '';
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return normalizeValue(String(value));
    }

    return '';
  }

  private parseIdsFilter(value?: string | string[]) {
    if (value === undefined) {
      return undefined;
    }

    const rawValues = Array.isArray(value) ? value : value.split(',');
    const ids = Array.from(
      new Set(
        rawValues
          .map((item) =>
            normalizeOptionalSingleLineText(item, 'Station id', {
              collapseWhitespace: false,
              maxLength: 36,
            }),
          )
          .filter((item): item is string => Boolean(item)),
      ),
    );

    if (ids.length === 0) {
      throw new AppError('At least one station id is required when ids filter is used', 400, 'INVALID_FILTER');
    }

    if (ids.length > MAX_ID_FILTERS) {
      throw new AppError(`At most ${MAX_ID_FILTERS} station ids can be filtered at once`, 400, 'INVALID_FILTER');
    }

    for (const id of ids) {
      if (!UUID_PATTERN.test(id)) {
        throw new AppError(`Invalid station id in ids filter: ${id}`, 400, 'INVALID_FILTER');
      }
    }

    return ids;
  }

  private normalizeCreatePayload(payload: StationCreatePayload): StationCreatePayload {
    const powerKw = normalizeRequiredFiniteNumber(payload.powerKw, 'Power (kW)', {
      maximum: MAX_STATION_POWER_KW,
      minimum: 0,
    });
    const lastTestDate = normalizeOptionalDateTime(payload.lastTestDate, 'Last test date');
    const customFields = normalizeOptionalObject(payload.customFields, 'Custom fields', {
      maxKeys: 100,
    });

    return {
      ...payload,
      name: normalizeRequiredSingleLineText(payload.name, 'Station name', {
        maxLength: 160,
        minLength: 2,
      }),
      code: normalizeRequiredSingleLineText(payload.code, 'Station code', {
        maxLength: 80,
        minLength: 2,
      }),
      qrCode: normalizeRequiredSingleLineText(payload.qrCode, 'QR code', {
        maxLength: 150,
        minLength: 2,
      }),
      brand: normalizeRequiredSingleLineText(payload.brand, 'Brand', {
        maxLength: 120,
        minLength: 1,
      }),
      model: normalizeRequiredSingleLineText(payload.model, 'Model', {
        maxLength: 120,
        minLength: 1,
      }),
      serialNumber: normalizeRequiredSingleLineText(payload.serialNumber, 'Serial number', {
        maxLength: 150,
        minLength: 2,
      }),
      powerKw,
      location: normalizeRequiredSingleLineText(payload.location, 'Location', {
        maxLength: 500,
        minLength: 2,
      }),
      lastTestDate: lastTestDate?.toISOString(),
      notes:
        normalizeOptionalMultilineText(payload.notes, 'Notes', {
          maxLength: 2000,
        }) ?? undefined,
      customFields: customFields ?? undefined,
    };
  }

  private normalizeUpdatePayload(payload: StationUpdatePayload): StationUpdatePayload {
    const powerKw = normalizeOptionalFiniteNumber(payload.powerKw, 'Power (kW)', {
      maximum: MAX_STATION_POWER_KW,
      minimum: 0,
    });
    const lastTestDate = normalizeOptionalDateTime(payload.lastTestDate, 'Last test date');
    const customFields = normalizeOptionalObject(payload.customFields, 'Custom fields', {
      maxKeys: 100,
    });

    return {
      ...payload,
      name:
        payload.name === undefined
          ? undefined
          : normalizeRequiredSingleLineText(payload.name, 'Station name', {
              maxLength: 160,
              minLength: 2,
            }),
      code:
        payload.code === undefined
          ? undefined
          : normalizeRequiredSingleLineText(payload.code, 'Station code', {
              maxLength: 80,
              minLength: 2,
            }),
      qrCode:
        payload.qrCode === undefined
          ? undefined
          : normalizeRequiredSingleLineText(payload.qrCode, 'QR code', {
              maxLength: 150,
              minLength: 2,
            }),
      brand:
        payload.brand === undefined
          ? undefined
          : normalizeRequiredSingleLineText(payload.brand, 'Brand', {
              maxLength: 120,
              minLength: 1,
            }),
      model:
        payload.model === undefined
          ? undefined
          : normalizeRequiredSingleLineText(payload.model, 'Model', {
              maxLength: 120,
              minLength: 1,
            }),
      serialNumber:
        payload.serialNumber === undefined
          ? undefined
          : normalizeRequiredSingleLineText(payload.serialNumber, 'Serial number', {
              maxLength: 150,
              minLength: 2,
            }),
      powerKw,
      location:
        payload.location === undefined
          ? undefined
          : normalizeRequiredSingleLineText(payload.location, 'Location', {
              maxLength: 500,
              minLength: 2,
            }),
      lastTestDate: lastTestDate?.toISOString(),
      notes:
        normalizeOptionalMultilineText(payload.notes, 'Notes', {
          maxLength: 2000,
        }) ?? undefined,
      customFields: customFields ?? undefined,
    };
  }

  private mapStationUniqueConstraintError(error: { constraint?: string }) {
    switch (error.constraint) {
      case 'stations_code_unique':
        return new AppError('Station code already exists', 409, 'STATION_CODE_EXISTS');
      case 'stations_qr_code_unique':
        return new AppError('Station QR code already exists', 409, 'STATION_QR_EXISTS');
      case 'stations_serial_number_unique':
        return new AppError('Station serial number already exists', 409, 'STATION_SERIAL_EXISTS');
      default:
        return new AppError('Station has duplicate unique fields', 409, 'STATION_DUPLICATE');
    }
  }

  private getSummary(summary?: StationMobileSummary): StationMobileSummary {
    return summary ?? {
      totalIssueCount: 0,
      openIssueCount: 0,
      hasOpenIssues: false,
      attachmentCount: 0,
      testHistoryCount: 0,
      latestTestResult: null,
    };
  }

  private getSyncMetadata(station: NonNullable<StationRecord>, includeConflictFields = false): StationSyncMetadata {
    return {
      updatedAt: station.updatedAt,
      isArchived: station.isArchived,
      archivedAt: station.archivedAt,
      isDeleted: false,
      deletedAt: null,
      deletionMode: 'hard_delete',
      ...(includeConflictFields ? { conflictFields: STATION_CONFLICT_FIELDS } : {}),
    };
  }

  private getCommonStationFields(station: NonNullable<StationRecord>): StationCommonResponse {
    return {
      id: station.id,
      name: station.name,
      code: station.code,
      qrCode: station.qrCode,
      brand: station.brand,
      model: station.model,
      powerKw: Number(station.powerKw),
      currentType: station.currentType,
      socketType: station.socketType,
      location: station.location,
      status: station.status,
      lastTestDate: station.lastTestDate,
      isArchived: station.isArchived,
      archivedAt: station.archivedAt,
      updatedAt: station.updatedAt,
    };
  }

  private toStationListResponse(
    station: NonNullable<StationRecord>,
    customFields: Record<string, unknown>,
    summary?: StationMobileSummary,
  ): StationFullListItemResponse {
    return {
      ...this.toStationCompactResponse(station, summary),
      serialNumber: station.serialNumber,
      notes: station.notes,
      createdAt: station.createdAt,
      customFields,
    };
  }

  private toStationCompactResponse(
    station: NonNullable<StationRecord>,
    summary?: StationMobileSummary,
  ): StationCompactResponse {
    return {
      ...this.getCommonStationFields(station),
      summary: this.getSummary(summary),
      sync: this.getSyncMetadata(station),
    };
  }

  private toStationSummaryResponse(
    station: NonNullable<StationRecord>,
    summary?: StationMobileSummary,
  ): StationSummaryResponse {
    return {
      ...this.getCommonStationFields(station),
      serialNumber: station.serialNumber,
      summary: this.getSummary(summary),
      sync: this.getSyncMetadata(station, true),
    };
  }

  private toStationDetailResponse(
    station: NonNullable<StationRecord>,
    customFields: Record<string, unknown>,
    summary?: StationMobileSummary,
  ): StationDetailResponse {
    return {
      ...this.toStationSummaryResponse(station, summary),
      notes: station.notes,
      createdAt: station.createdAt,
      customFields,
    };
  }
}

export const stationsService = new StationsService();
