import { AppError } from '../../utils/errors';
import { isUniqueViolation } from '../../utils/db-errors';
import { writeAuditLog } from '../../utils/audit-log';

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
  search?: string;
  status?: 'active' | 'maintenance' | 'inactive' | 'faulty' | 'archived';
  brand?: string;
  currentType?: 'AC' | 'DC';
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'lastTestDate' | 'powerKw';
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
} & Record<string, unknown>;

const allowedQueryKeys = new Set([
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
    const customFieldFilters = this.extractCustomFieldFilters(query);
    const customFilteredStationIds = await this.cfService.getStationIdsByCustomFilters(customFieldFilters);

    const listFilters: StationListFilter = {
      search: query.search,
      status: query.status,
      brand: query.brand,
      currentType: query.currentType,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
      includeArchived: query.includeArchived,
      customFilteredStationIds,
    };

    const rows = await this.repository.list(listFilters);

    if (rows.length === 0) {
      return [];
    }

    const customFieldMap = await this.cfService.getStationCustomFieldMap(rows.map((row) => row.id));
    return rows.map((row) => this.toStationResponse(row, customFieldMap.get(row.id) ?? {}));
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
      const created = await this.repository.create({
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
      });

      if (payload.customFields) {
        await this.cfService.upsertStationCustomFieldValues(created.id, payload.customFields);
      }

      await writeAuditLog({
        actorUserId: userId,
        entityType: 'station',
        entityId: created.id,
        action: 'station.created',
      });

      return this.getById(created.id);
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
      const updated = await this.repository.updateById(id, {
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
      });

      if (!updated) {
        throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
      }

      if (payload.customFields) {
        await this.cfService.upsertStationCustomFieldValues(id, payload.customFields);
      }

      await writeAuditLog({
        actorUserId: userId,
        entityType: 'station',
        entityId: id,
        action: 'station.updated',
      });

      return this.getById(updated.id);
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

    await this.repository.deleteById(id);

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'station',
      entityId: id,
      action: 'station.deleted',
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

    const archived = await this.repository.archiveById(id, userId);

    if (!archived) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'station',
      entityId: id,
      action: 'station.archived',
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

  async updateLastTestDate(stationId: string, testDate: Date) {
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
