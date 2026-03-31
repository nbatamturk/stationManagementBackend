import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stations } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { isUniqueViolation } from '../../utils/db-errors';
import { AppError } from '../../utils/errors';

import { customFieldsService, type CustomFieldsService } from '../custom-fields/custom-fields.service';
import { stationsRepository, type StationListFilter, type StationsRepository } from './stations.repository';

type StationRecord = Awaited<ReturnType<StationsRepository['findById']>>;

type StationCreatePayload = {
  name: string;
  code: string;
  qrCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: number;
  currentType: 'AC' | 'DC';
  socketType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
  location: string;
  status?: 'active' | 'maintenance' | 'inactive' | 'faulty' | 'archived';
  lastTestDate?: string;
  notes?: string;
  customFields?: Record<string, unknown>;
};

type StationUpdatePayload = Partial<StationCreatePayload>;

type StationListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: 'active' | 'maintenance' | 'inactive' | 'faulty' | 'archived';
  brand?: string;
  currentType?: 'AC' | 'DC';
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastTestDate' | 'powerKw';
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
} & Record<string, unknown>;

const allowedQueryKeys = new Set([
  'page',
  'limit',
  'search',
  'status',
  'brand',
  'currentType',
  'sortBy',
  'sortOrder',
  'includeArchived',
]);

export class StationsService {
  constructor(
    private readonly repository: StationsRepository = stationsRepository,
    private readonly cfService: CustomFieldsService = customFieldsService,
  ) {}

  async list(query: StationListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const customFieldFilters = this.extractCustomFieldFilters(query);
    const customFilteredStationIds = await this.cfService.getStationIdsByCustomFilters(customFieldFilters);

    const listFilters: StationListFilter = {
      page,
      limit,
      search: query.search,
      status: query.status,
      brand: query.brand,
      currentType: query.currentType,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      includeArchived: query.includeArchived,
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

    const customFieldMap = await this.cfService.getStationCustomFieldMap(rows.map((row) => row.id));

    return {
      data: rows.map((row) => this.toStationResponse(row, customFieldMap.get(row.id) ?? {})),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    const customFieldMap = await this.cfService.getStationCustomFieldMap([id]);
    return this.toStationResponse(station, customFieldMap.get(id) ?? {});
  }

  async create(userId: string, payload: StationCreatePayload) {
    try {
      const stationId = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(stations)
          .values({
            name: payload.name,
            code: payload.code,
            qrCode: payload.qrCode,
            brand: payload.brand,
            model: payload.model,
            serialNumber: payload.serialNumber,
            powerKw: payload.powerKw.toString(),
            currentType: payload.currentType,
            socketType: payload.socketType,
            location: payload.location,
            status: payload.status ?? 'active',
            lastTestDate: payload.lastTestDate ? new Date(payload.lastTestDate) : undefined,
            notes: payload.notes,
            isArchived: payload.status === 'archived',
            archivedAt: payload.status === 'archived' ? new Date() : undefined,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: stations.id });

        if (!created) {
          throw new Error('Failed to create station');
        }

        if (payload.customFields) {
          await this.cfService.upsertStationCustomFieldValues(created.id, payload.customFields, tx);
        }

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
        const constraint = (error as { constraint?: string }).constraint;

        if (constraint === 'stations_code_unique') {
          throw new AppError('Station code already exists', 409, 'STATION_CODE_EXISTS');
        }

        if (constraint === 'stations_qr_code_unique') {
          throw new AppError('Station QR code already exists', 409, 'STATION_QR_EXISTS');
        }

        if (constraint === 'stations_serial_number_unique') {
          throw new AppError('Station serial number already exists', 409, 'STATION_SERIAL_EXISTS');
        }

        throw new AppError('Station has duplicate unique fields', 409, 'STATION_DUPLICATE');
      }

      throw error;
    }
  }

  async update(userId: string, id: string, payload: StationUpdatePayload) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    try {
      await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(stations)
          .set({
            name: payload.name,
            code: payload.code,
            qrCode: payload.qrCode,
            brand: payload.brand,
            model: payload.model,
            serialNumber: payload.serialNumber,
            powerKw: payload.powerKw !== undefined ? payload.powerKw.toString() : undefined,
            currentType: payload.currentType,
            socketType: payload.socketType,
            location: payload.location,
            status: payload.status,
            lastTestDate: payload.lastTestDate ? new Date(payload.lastTestDate) : undefined,
            notes: payload.notes,
            isArchived: payload.status ? payload.status === 'archived' : station.isArchived,
            archivedAt:
              payload.status === 'archived'
                ? station.archivedAt ?? new Date()
                : payload.status
                  ? null
                  : undefined,
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(stations.id, id))
          .returning({ id: stations.id });

        if (!updated) {
          throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
        }

        if (payload.customFields) {
          await this.cfService.upsertStationCustomFieldValues(id, payload.customFields, tx);
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
        throw new AppError('Station has duplicate unique fields', 409, 'STATION_DUPLICATE');
      }

      throw error;
    }
  }

  async delete(userId: string, id: string) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    await db.transaction(async (tx) => {
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
    });

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
          status: 'archived',
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

  private extractCustomFieldFilters(query: StationListQuery): Record<string, string> {
    const filters: Record<string, string> = {};

    for (const [key, rawValue] of Object.entries(query)) {
      if (allowedQueryKeys.has(key)) {
        continue;
      }

      if (!key.startsWith('cf.')) {
        throw new AppError(`Unknown filter parameter: ${key}`, 400, 'INVALID_FILTER');
      }

      const customFieldKey = key.slice(3);

      if (!customFieldKey) {
        throw new AppError('Custom filter key is empty', 400, 'INVALID_FILTER');
      }

      const value = this.normalizeFilterValue(rawValue);

      if (!value) {
        throw new AppError(`Custom filter value is invalid for ${key}`, 400, 'INVALID_FILTER');
      }

      filters[customFieldKey] = value;
    }

    return filters;
  }

  private normalizeFilterValue(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    if (Array.isArray(value)) {
      const first = value.find((item) => typeof item === 'string');
      return first ?? '';
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return '';
  }

  private toStationResponse(station: NonNullable<StationRecord>, customFields: Record<string, unknown>) {
    return {
      id: station.id,
      name: station.name,
      code: station.code,
      qrCode: station.qrCode,
      brand: station.brand,
      model: station.model,
      serialNumber: station.serialNumber,
      powerKw: Number(station.powerKw),
      currentType: station.currentType,
      socketType: station.socketType,
      location: station.location,
      status: station.status,
      lastTestDate: station.lastTestDate,
      notes: station.notes,
      isArchived: station.isArchived,
      archivedAt: station.archivedAt,
      createdAt: station.createdAt,
      updatedAt: station.updatedAt,
      customFields,
    };
  }
}

export const stationsService = new StationsService();
