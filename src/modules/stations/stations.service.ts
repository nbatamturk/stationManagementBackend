import { eq, sql } from 'drizzle-orm';

import { db } from '../../db/client';
import { connectorTypeValues, currentTypeValues, stationStatusValues } from '../../contracts/domain';
import { stations, type CurrentType, type StationStatus } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { UUID_PATTERN } from '../../utils/api-schemas';
import { getPgError, isForeignKeyViolation, isUniqueViolation } from '../../utils/db-errors';
import { AppError } from '../../utils/errors';
import {
  normalizeOptionalDateTime,
  normalizeOptionalObject,
  normalizeOptionalMultilineText,
  normalizeOptionalSingleLineText,
} from '../../utils/input';

import { attachmentsService } from '../attachments/attachments.service';
import { customFieldsService, type CustomFieldsService } from '../custom-fields/custom-fields.service';
import { stationCatalogRepository, type StationCatalogRepository } from './station-catalog.repository';
import {
  stationConnectorsRepository,
  type StationModelConnectorTemplateRow,
  type StationConnectorsRepository,
} from './station-connectors.repository';
import {
  buildConnectorSummary,
  buildDerivedStationConnectorFields,
  normalizeStationConnectors,
  sortStationConnectorResponses,
  type NormalizedStationConnectorInput,
  type StationConnectorInput,
  type StationConnectorResponse,
  type StationConnectorSummary,
} from './station-connectors';
import {
  buildStationModelImageInlineContentDisposition,
  buildStationModelImageStoragePath,
  deleteStoredStationModelImageFile,
  ensureStationModelImageReadable,
  validateAndNormalizeModelImage,
  writeStationModelImageBuffer,
} from './station-model-images.storage';
import {
  stationsRepository,
  type StationListFilter,
  type StationMobileSummary,
  type StationsRepository,
} from './stations.repository';

type StationRecord = NonNullable<Awaited<ReturnType<StationsRepository['findById']>>>;
type ConnectorRow = Awaited<ReturnType<StationConnectorsRepository['listActiveByStationIds']>>[number];
type BrandRecord = NonNullable<Awaited<ReturnType<StationCatalogRepository['findBrandById']>>>;
type ModelRecord = NonNullable<Awaited<ReturnType<StationCatalogRepository['findModelById']>>>;

type StationCommonResponse = {
  id: string;
  name: string;
  code: string;
  qrCode: string;
  brandId: string;
  modelId: string;
  brand: string;
  model: string;
  powerKw: number;
  currentType: CurrentType;
  socketType: string;
  location: string;
  status: StationStatus;
  lastTestDate: Date | null;
  isArchived: boolean;
  archivedAt: Date | null;
  updatedAt: Date;
  modelTemplateVersion: number | null;
  connectorSummary: StationConnectorSummary;
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
  connectors: StationConnectorResponse[];
  customFields: Record<string, unknown>;
};

type StationListItemResponse = StationFullListItemResponse | StationCompactResponse;

type StationCatalogBrandResponse = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type StationCatalogModelResponse = {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  logoUrl: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  latestTemplateVersion: number | null;
  latestTemplateConnectors: NormalizedStationConnectorInput[];
};

type StationConfigResponse = {
  statuses: StationStatus[];
  currentTypes: CurrentType[];
  connectorTypes: StationConnectorSummary['types'];
  brands: StationCatalogBrandResponse[];
  models: StationCatalogModelResponse[];
};

type StationListResult<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type StationCatalogSelectionPayload = {
  brandId?: string;
  modelId?: string;
  brand?: string;
  model?: string;
};

type StationCreatePayload = StationCatalogSelectionPayload & {
  name: string;
  code: string;
  qrCode: string;
  serialNumber: string;
  location: string;
  status?: StationStatus;
  lastTestDate?: string | null;
  notes?: string | null;
  connectors?: StationConnectorInput[];
  customFields?: Record<string, unknown>;
};

type StationUpdatePayload = Partial<StationCreatePayload>;

type StationCatalogBrandCreatePayload = {
  name: string;
  isActive?: boolean;
};

type StationCatalogBrandUpdatePayload = Partial<StationCatalogBrandCreatePayload>;

type StationCatalogModelCreatePayload = {
  brandId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  logoUrl?: string | null;
  isActive?: boolean;
};

type StationCatalogModelUpdatePayload = Partial<StationCatalogModelCreatePayload>;

type StationCatalogModelTemplateUpdatePayload = {
  connectors: StationConnectorInput[];
};

type StationModelImageUploadPayload = {
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

type StationListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  code?: string;
  qrCode?: string;
  model?: string;
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
  'model',
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
const MAX_STATION_POWER_KW = 1000;

type ConnectorData = {
  connectorsByStationId: Map<string, StationConnectorResponse[]>;
  connectorSummaryByStationId: Map<string, StationConnectorSummary>;
};

type NormalizedStationCreatePayload = Omit<StationCreatePayload, 'connectors'> & {
  connectors?: NormalizedStationConnectorInput[];
};

type NormalizedStationUpdatePayload = Omit<StationUpdatePayload, 'connectors'> & {
  connectors?: NormalizedStationConnectorInput[];
};

type ResolvedStationCatalogSelection = {
  brandId: string;
  modelId: string;
  brandName: string;
  modelName: string;
};

type TemplatePrefill = {
  version: number;
  connectors: NormalizedStationConnectorInput[];
};

export class StationsService {
  constructor(
    private readonly repository: StationsRepository = stationsRepository,
    private readonly cfService: CustomFieldsService = customFieldsService,
    private readonly catalogRepository: StationCatalogRepository = stationCatalogRepository,
    private readonly connectorsRepository: StationConnectorsRepository = stationConnectorsRepository,
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
    const normalizedModel =
      normalizeOptionalSingleLineText(query.model, 'Model', {
        maxLength: 120,
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
    const powerMin = this.normalizeOptionalPower(query.powerMin, 'Power minimum');
    const powerMax = this.normalizeOptionalPower(query.powerMax, 'Power maximum');

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
      model: normalizedModel,
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

    const [summaryMap, customFieldMap, connectorData] = await Promise.all([
      this.repository.getMobileSummaryMap(rows.map((row) => row.id)),
      view === 'compact'
        ? Promise.resolve(new Map<string, Record<string, unknown>>())
        : this.cfService.getStationCustomFieldMap(rows.map((row) => row.id)),
      this.loadConnectorData(rows),
    ]);

    if (view === 'compact') {
      return {
        data: rows.map((row) =>
          this.toStationCompactResponse(
            row as StationRecord,
            connectorData.connectorSummaryByStationId.get(row.id),
            summaryMap.get(row.id),
          ),
        ),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    return {
      data: rows.map((row) =>
        this.toStationListResponse(
          row as StationRecord,
          customFieldMap.get(row.id) ?? {},
          connectorData.connectorSummaryByStationId.get(row.id),
          summaryMap.get(row.id),
        ),
      ),
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

    const [customFieldMap, summaryMap, connectorData] = await Promise.all([
      this.cfService.getStationCustomFieldMap([id]),
      this.repository.getMobileSummaryMap([id]),
      this.loadConnectorData([station as StationRecord]),
    ]);

    return this.toStationDetailResponse(
      station as StationRecord,
      customFieldMap.get(id) ?? {},
      connectorData.connectorsByStationId.get(id) ?? [],
      connectorData.connectorSummaryByStationId.get(id),
      summaryMap.get(id),
    );
  }

  async getSummaryById(id: string) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    const [summaryMap, connectorData] = await Promise.all([
      this.repository.getMobileSummaryMap([id]),
      this.loadConnectorData([station as StationRecord]),
    ]);

    return this.toStationSummaryResponse(
      station as StationRecord,
      connectorData.connectorSummaryByStationId.get(id),
      summaryMap.get(id),
    );
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

    const [summaryMap, connectorData] = await Promise.all([
      this.repository.getMobileSummaryMap([station.id]),
      this.loadConnectorData([station as StationRecord]),
    ]);

    return this.toStationSummaryResponse(
      station as StationRecord,
      connectorData.connectorSummaryByStationId.get(station.id),
      summaryMap.get(station.id),
    );
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

  async getConfig(): Promise<StationConfigResponse> {
    const [brands, models] = (await Promise.all([
      this.catalogRepository.listBrands(),
      this.catalogRepository.listModels(),
    ])) as [BrandRecord[], ModelRecord[]];

    const mappedModels = await Promise.all(
      models.map((model) => this.toCatalogModelResponse(model)),
    );

    return {
      statuses: [...stationStatusValues],
      currentTypes: [...currentTypeValues],
      connectorTypes: [...connectorTypeValues],
      brands: brands.map((brand) => this.toCatalogBrandResponse(brand)),
      models: mappedModels,
    };
  }

  async createBrand(userId: string, payload: StationCatalogBrandCreatePayload) {
    const normalized = this.normalizeBrandCreatePayload(payload);

    try {
      const brand = await db.transaction(async (tx) => {
        const created = await this.catalogRepository.createBrand(
          {
            name: normalized.name,
            isActive: normalized.isActive ?? true,
          },
          tx,
        );

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station_brand',
            entityId: created.id,
            action: 'station_brand.created',
          },
          tx,
        );

        return created;
      });

      return this.toCatalogBrandResponse(brand as BrandRecord);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw this.mapCatalogUniqueConstraintError(getPgError(error) ?? {});
      }

      throw error;
    }
  }

  async updateBrand(userId: string, id: string, payload: StationCatalogBrandUpdatePayload) {
    const existing = await this.catalogRepository.findBrandById(id);

    if (!existing) {
      throw new AppError('Station brand not found', 404, 'STATION_BRAND_NOT_FOUND');
    }

    const normalized = this.normalizeBrandUpdatePayload(payload);

    try {
      const brand = await db.transaction(async (tx) => {
        const updated = await this.catalogRepository.updateBrand(
          id,
          {
            name: normalized.name,
            isActive: normalized.isActive,
          },
          tx,
        );

        if (!updated) {
          throw new AppError('Station brand not found', 404, 'STATION_BRAND_NOT_FOUND');
        }

        if (normalized.name && normalized.name !== existing.name) {
          await tx
            .update(stations)
            .set({
              brand: normalized.name,
              updatedAt: new Date(),
            })
            .where(eq(stations.brandId, id));
        }

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station_brand',
            entityId: id,
            action: 'station_brand.updated',
          },
          tx,
        );

        return updated;
      });

      return this.toCatalogBrandResponse(brand as BrandRecord);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw this.mapCatalogUniqueConstraintError(getPgError(error) ?? {});
      }

      throw error;
    }
  }

  async deleteBrand(userId: string, id: string) {
    const existing = await this.catalogRepository.findBrandById(id);

    if (!existing) {
      throw new AppError('Station brand not found', 404, 'STATION_BRAND_NOT_FOUND');
    }

    try {
      await db.transaction(async (tx) => {
        const deleted = await this.catalogRepository.deleteBrand(id, tx);

        if (!deleted) {
          throw new AppError('Station brand not found', 404, 'STATION_BRAND_NOT_FOUND');
        }

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station_brand',
            entityId: id,
            action: 'station_brand.deleted',
            metadataJson: {
              name: existing.name,
            },
          },
          tx,
        );
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new AppError(
          'Station brand cannot be deleted while stations still use it',
          409,
          'STATION_BRAND_IN_USE',
        );
      }

      throw error;
    }

    return {
      success: true as const,
      id,
    };
  }

  async createModel(userId: string, payload: StationCatalogModelCreatePayload) {
    const normalized = this.normalizeModelCreatePayload(payload);
    const brand = await this.catalogRepository.findBrandById(normalized.brandId);

    if (!brand) {
      throw new AppError('Station brand not found', 404, 'STATION_BRAND_NOT_FOUND');
    }

    try {
      const model = await db.transaction(async (tx) => {
        const created = await this.catalogRepository.createModel(
          {
            brandId: normalized.brandId,
            name: normalized.name,
            description: normalized.description,
            imageUrl: normalized.imageUrl,
            logoUrl: normalized.logoUrl,
            isActive: normalized.isActive ?? true,
          },
          tx,
        );

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station_model',
            entityId: created.id,
            action: 'station_model.created',
          },
          tx,
        );

        return created;
      });

      return this.toCatalogModelResponse(model as ModelRecord);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw this.mapCatalogUniqueConstraintError(getPgError(error) ?? {});
      }

      throw error;
    }
  }

  async updateModel(userId: string, id: string, payload: StationCatalogModelUpdatePayload) {
    const existing = await this.catalogRepository.findModelById(id);

    if (!existing) {
      throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
    }

    const normalized = this.normalizeModelUpdatePayload(payload);
    const nextBrandId = normalized.brandId ?? existing.brandId;

    if (nextBrandId !== existing.brandId) {
      const stationsUsingModel = await db
        .select({ id: stations.id })
        .from(stations)
        .where(eq(stations.modelId, id))
        .limit(1);

      if (stationsUsingModel.length > 0) {
        throw new AppError(
          'Station models linked to stations cannot be moved to another brand',
          400,
          'STATION_MODEL_BRAND_CHANGE_BLOCKED',
        );
      }
    }

    const brand = await this.catalogRepository.findBrandById(nextBrandId);

    if (!brand) {
      throw new AppError('Station brand not found', 404, 'STATION_BRAND_NOT_FOUND');
    }

    try {
      const model = await db.transaction(async (tx) => {
        const updated = await this.catalogRepository.updateModel(
          id,
          {
            brandId: normalized.brandId,
            name: normalized.name,
            description: normalized.description,
            imageUrl: normalized.imageUrl,
            logoUrl: normalized.logoUrl,
            isActive: normalized.isActive,
          },
          tx,
        );

        if (!updated) {
          throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
        }

        if (normalized.name && normalized.name !== existing.name) {
          await tx
            .update(stations)
            .set({
              model: normalized.name,
              updatedAt: new Date(),
            })
            .where(eq(stations.modelId, id));
        }

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station_model',
            entityId: id,
            action: 'station_model.updated',
          },
          tx,
        );

        return updated;
      });

      return this.toCatalogModelResponse(model as ModelRecord);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw this.mapCatalogUniqueConstraintError(getPgError(error) ?? {});
      }

      throw error;
    }
  }

  async deleteModel(userId: string, id: string) {
    const existing = await this.catalogRepository.findModelById(id);

    if (!existing) {
      throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
    }

    try {
      await db.transaction(async (tx) => {
        const deleted = await this.catalogRepository.deleteModel(id, tx);

        if (!deleted) {
          throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
        }

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station_model',
            entityId: id,
            action: 'station_model.deleted',
            metadataJson: {
              name: existing.name,
              brandId: existing.brandId,
              hadStoredImage: Boolean(existing.imageStoragePath),
            },
          },
          tx,
        );
      });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new AppError(
          'Station model cannot be deleted while stations still use it',
          409,
          'STATION_MODEL_IN_USE',
        );
      }

      throw error;
    }

    if (existing.imageStoragePath) {
      try {
        await deleteStoredStationModelImageFile(existing.imageStoragePath);
      } catch (cleanupError) {
        console.error('Failed to remove station model image after deleting model', cleanupError);
      }
    }

    return {
      success: true as const,
      id,
    };
  }

  async uploadModelImage(userId: string, id: string, file: StationModelImageUploadPayload) {
    const existing = await this.catalogRepository.findModelById(id);

    if (!existing) {
      throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
    }

    const normalizedImage = await validateAndNormalizeModelImage(file);
    const storagePath = buildStationModelImageStoragePath({
      modelId: existing.id,
      originalFileName: normalizedImage.originalFileName,
      mimeType: normalizedImage.mimeType,
    });

    await writeStationModelImageBuffer(storagePath, normalizedImage.buffer);

    try {
      const updated = await db.transaction(async (tx) => {
        const saved = await this.catalogRepository.updateModel(
          id,
          {
            imageUrl: null,
            logoUrl: null,
            imageStoragePath: storagePath,
            imageMimeType: normalizedImage.mimeType,
            imageOriginalFileName: normalizedImage.originalFileName,
            imageSizeBytes: normalizedImage.sizeBytes,
            imageUpdatedAt: new Date(),
          },
          tx,
        );

        if (!saved) {
          throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
        }

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station_model',
            entityId: id,
            action: 'station_model.image_uploaded',
            metadataJson: {
              mimeType: normalizedImage.mimeType,
              sizeBytes: normalizedImage.sizeBytes,
              originalFileName: normalizedImage.originalFileName,
            },
          },
          tx,
        );

        return saved;
      });

      if (existing.imageStoragePath && existing.imageStoragePath !== storagePath) {
        try {
          await deleteStoredStationModelImageFile(existing.imageStoragePath);
        } catch (cleanupError) {
          console.error('Failed to remove replaced station model image', cleanupError);
        }
      }

      return this.toCatalogModelResponse(updated as ModelRecord);
    } catch (error) {
      try {
        await deleteStoredStationModelImageFile(storagePath);
      } catch (cleanupError) {
        console.error('Failed to roll back station model image file after database error', cleanupError);
      }

      throw error;
    }
  }

  async deleteModelImage(userId: string, id: string) {
    const existing = await this.catalogRepository.findModelById(id);

    if (!existing) {
      throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
    }

    const hadAnyImage = Boolean(existing.imageStoragePath || existing.imageUrl || existing.logoUrl);

    await db.transaction(async (tx) => {
      const updated = await this.catalogRepository.updateModel(
        id,
        {
          imageUrl: null,
          logoUrl: null,
          imageStoragePath: null,
          imageMimeType: null,
          imageOriginalFileName: null,
          imageSizeBytes: null,
          imageUpdatedAt: null,
        },
        tx,
      );

      if (!updated) {
        throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
      }

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'station_model',
          entityId: id,
          action: 'station_model.image_deleted',
          metadataJson: {
            hadAnyImage,
            hadStoredImage: Boolean(existing.imageStoragePath),
          },
        },
        tx,
      );
    });

    if (existing.imageStoragePath) {
      try {
        await deleteStoredStationModelImageFile(existing.imageStoragePath);
      } catch (cleanupError) {
        console.error('Failed to remove deleted station model image from storage', cleanupError);
      }
    }

    return {
      success: true as const,
      id,
    };
  }

  async prepareModelImageDownload(userId: string, id: string) {
    const existing = await this.catalogRepository.findModelById(id);

    if (!existing) {
      throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
    }

    if (!existing.imageStoragePath || !existing.imageMimeType || !existing.imageOriginalFileName || !existing.imageSizeBytes) {
      throw new AppError('Station model image not found', 404, 'STATION_MODEL_IMAGE_NOT_FOUND');
    }

    const absolutePath = await ensureStationModelImageReadable(existing.imageStoragePath);

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'station_model',
      entityId: id,
      action: 'station_model.image_downloaded',
      metadataJson: {
        mimeType: existing.imageMimeType,
      },
    });

    return {
      absolutePath,
      mimeType: existing.imageMimeType,
      sizeBytes: existing.imageSizeBytes,
      contentDisposition: buildStationModelImageInlineContentDisposition(existing.imageOriginalFileName),
    };
  }

  async replaceModelTemplate(userId: string, id: string, payload: StationCatalogModelTemplateUpdatePayload) {
    const model = await this.catalogRepository.findModelById(id);

    if (!model) {
      throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
    }

    const connectors = normalizeStationConnectors(payload.connectors);

    await db.transaction(async (tx) => {
      const nextVersion = ((await this.connectorsRepository.getLatestTemplateVersion(id, tx)) ?? 0) + 1;

      await this.connectorsRepository.insertTemplateVersion(id, nextVersion, connectors, tx);
      await this.catalogRepository.updateModel(id, {}, tx);

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'station_model',
          entityId: id,
          action: 'station_model.template_replaced',
          metadataJson: {
            connectorCount: connectors.length,
            version: nextVersion,
          },
        },
        tx,
      );
    });

    const refreshed = await this.catalogRepository.findModelById(id);

    if (!refreshed) {
      throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
    }

    return this.toCatalogModelResponse(refreshed as ModelRecord);
  }

  async create(userId: string, payload: StationCreatePayload) {
    const normalizedPayload = this.normalizeCreatePayload(payload);

    try {
      const stationId = await db.transaction(async (tx) => {
        const catalog = await this.resolveStationCatalogSelection(normalizedPayload, undefined, tx);
        const templatePrefill =
          normalizedPayload.connectors === undefined
            ? await this.getTemplateConnectorPrefill(catalog.modelId, tx)
            : null;
        const connectors = normalizedPayload.connectors ?? templatePrefill?.connectors;

        if (!connectors || connectors.length === 0) {
          throw new AppError('Stations must include at least one connector', 400, 'STATION_CONNECTOR_REQUIRED');
        }

        const derived = buildDerivedStationConnectorFields(connectors);

        const [created] = await tx
          .insert(stations)
          .values({
            name: normalizedPayload.name,
            code: normalizedPayload.code,
            qrCode: normalizedPayload.qrCode,
            brandId: catalog.brandId,
            modelId: catalog.modelId,
            brand: catalog.brandName,
            model: catalog.modelName,
            serialNumber: normalizedPayload.serialNumber,
            powerKw: derived.powerKw.toString(),
            currentType: derived.currentType,
            socketType: derived.socketType,
            location: normalizedPayload.location,
            status: normalizedPayload.status ?? 'active',
            lastTestDate:
              normalizedPayload.lastTestDate === undefined
                ? undefined
                : normalizedPayload.lastTestDate === null
                  ? null
                  : new Date(normalizedPayload.lastTestDate),
            notes: normalizedPayload.notes,
            isArchived: false,
            archivedAt: undefined,
            modelTemplateVersion: templatePrefill?.version ?? null,
            createdBy: userId,
            updatedBy: userId,
          })
          .returning({ id: stations.id });

        if (!created) {
          throw new Error('Failed to create station');
        }

        await this.connectorsRepository.insertForStation(created.id, connectors, tx);

        await this.cfService.upsertStationCustomFieldValues(created.id, normalizedPayload.customFields ?? {}, tx, {
          enforceRequiredDefinitions: true,
        });

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station',
            entityId: created.id,
            action: 'station.created',
            metadataJson: {
              connectorCount: connectors.length,
              modelTemplateVersion: templatePrefill?.version ?? null,
            },
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
    const hasCustomFieldUpdates = normalizedPayload.customFields !== undefined;
    const hasStationFieldUpdates = [
      normalizedPayload.name,
      normalizedPayload.code,
      normalizedPayload.qrCode,
      normalizedPayload.brandId,
      normalizedPayload.modelId,
      normalizedPayload.brand,
      normalizedPayload.model,
      normalizedPayload.serialNumber,
      normalizedPayload.location,
      normalizedPayload.status,
      normalizedPayload.lastTestDate,
      normalizedPayload.notes,
      normalizedPayload.connectors,
    ].some((value) => value !== undefined);

    if (!hasStationFieldUpdates && !hasCustomFieldUpdates) {
      return this.getById(id);
    }

    if (station.isArchived && normalizedPayload.status && normalizedPayload.status !== 'inactive') {
      throw new AppError('Archived stations must use inactive status', 400, 'INVALID_STATION_STATUS');
    }

    try {
      await db.transaction(async (tx) => {
        const catalog = await this.resolveStationCatalogSelection(normalizedPayload, station, tx);
        const modelChanged =
          catalog.brandId !== station.brandId ||
          catalog.modelId !== station.modelId ||
          catalog.brandName !== station.brand ||
          catalog.modelName !== station.model;
        const nextConnectors = normalizedPayload.connectors;
        const derived =
          nextConnectors !== undefined
            ? buildDerivedStationConnectorFields(nextConnectors)
            : {
                currentType: station.currentType,
                powerKw: Number(station.powerKw),
                socketType: station.socketType,
              };

        const [updated] = await tx
          .update(stations)
          .set({
            name: normalizedPayload.name,
            code: normalizedPayload.code,
            qrCode: normalizedPayload.qrCode,
            brandId: catalog.brandId,
            modelId: catalog.modelId,
            brand: catalog.brandName,
            model: catalog.modelName,
            serialNumber: normalizedPayload.serialNumber,
            powerKw: derived.powerKw.toString(),
            currentType: derived.currentType,
            socketType: derived.socketType,
            location: normalizedPayload.location,
            status: normalizedPayload.status,
            lastTestDate:
              normalizedPayload.lastTestDate === undefined
                ? undefined
                : normalizedPayload.lastTestDate === null
                  ? sql`null`
                  : new Date(normalizedPayload.lastTestDate),
            notes: normalizedPayload.notes === null ? sql`null` : normalizedPayload.notes,
            isArchived: station.isArchived,
            archivedAt: station.archivedAt,
            modelTemplateVersion:
              nextConnectors !== undefined || modelChanged ? null : station.modelTemplateVersion,
            updatedBy: userId,
            updatedAt: new Date(),
          })
          .where(eq(stations.id, id))
          .returning({ id: stations.id });

        if (!updated) {
          throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
        }

        if (nextConnectors !== undefined) {
          await this.connectorsRepository.softDeleteActiveByStationId(id, tx);
          await this.connectorsRepository.insertForStation(id, nextConnectors, tx);
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
            metadataJson: {
              connectorsReplaced: nextConnectors !== undefined,
              modelChanged,
            },
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

  async applyModelTemplate(userId: string, id: string) {
    const station = await this.repository.findById(id);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    if (!station.modelId) {
      throw new AppError('Station must have a model before applying a template', 400, 'STATION_MODEL_REQUIRED');
    }

    const templatePrefill = await this.getTemplateConnectorPrefill(station.modelId);

    if (!templatePrefill || templatePrefill.connectors.length === 0) {
      throw new AppError('The selected station model has no connector template', 400, 'STATION_MODEL_TEMPLATE_EMPTY');
    }

    const derived = buildDerivedStationConnectorFields(templatePrefill.connectors);

    await db.transaction(async (tx) => {
      await this.connectorsRepository.softDeleteActiveByStationId(id, tx);
      await this.connectorsRepository.insertForStation(id, templatePrefill.connectors, tx);

      const [updated] = await tx
        .update(stations)
        .set({
          powerKw: derived.powerKw.toString(),
          currentType: derived.currentType,
          socketType: derived.socketType,
          modelTemplateVersion: templatePrefill.version,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(stations.id, id))
        .returning({ id: stations.id });

      if (!updated) {
        throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
      }

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'station',
          entityId: id,
          action: 'station.model_template_applied',
          metadataJson: {
            modelTemplateVersion: templatePrefill.version,
            connectorCount: templatePrefill.connectors.length,
          },
        },
        tx,
      );
    });

    return this.getById(id);
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

  private async resolveCatalogModel(brandName: string, modelName: string, executor: any = db) {
    const existingBrand = await this.catalogRepository.findBrandByName(brandName, executor);
    const brand =
      existingBrand ??
      (await this.catalogRepository.createBrand(
        {
          name: brandName,
          isActive: true,
        },
        executor,
      ));
    const existingModel = await this.catalogRepository.findModelByBrandAndName(brand.id, modelName, executor);
    const model =
      existingModel ??
      (await this.catalogRepository.createModel(
        {
          brandId: brand.id,
          name: modelName,
          description: null,
          imageUrl: null,
          logoUrl: null,
          isActive: true,
        },
        executor,
      ));

    return {
      brandId: brand.id,
      modelId: model.id,
      brandName: brand.name,
      modelName: model.name,
    };
  }

  private async resolveStationCatalogSelection(
    payload: StationCatalogSelectionPayload,
    currentStation?: StationRecord,
    executor: any = db,
  ): Promise<ResolvedStationCatalogSelection> {
    const usesCatalogIds = payload.brandId !== undefined || payload.modelId !== undefined;
    const usesCatalogNames = payload.brand !== undefined || payload.model !== undefined;
    const nextBrandId = payload.brandId ?? currentStation?.brandId;
    const nextModelId = payload.modelId ?? currentStation?.modelId;

    if (usesCatalogIds || (!usesCatalogNames && (nextBrandId || nextModelId))) {
      if (!nextBrandId || !nextModelId) {
        throw new AppError(
          'Station brandId and modelId must be provided together when using catalog ids',
          400,
          'STATION_CATALOG_IDS_REQUIRED',
        );
      }

      const brand = await this.catalogRepository.findBrandById(nextBrandId, executor);

      if (!brand) {
        throw new AppError('Station brand not found', 404, 'STATION_BRAND_NOT_FOUND');
      }

      const model = await this.catalogRepository.findModelById(nextModelId, executor);

      if (!model) {
        throw new AppError('Station model not found', 404, 'STATION_MODEL_NOT_FOUND');
      }

      if (model.brandId !== brand.id) {
        throw new AppError(
          'The selected station model does not belong to the selected brand',
          400,
          'STATION_MODEL_BRAND_MISMATCH',
        );
      }

      return {
        brandId: brand.id,
        modelId: model.id,
        brandName: brand.name,
        modelName: model.name,
      };
    }

    const nextBrandName = payload.brand ?? currentStation?.brand;
    const nextModelName = payload.model ?? currentStation?.model;

    if (!nextBrandName || !nextModelName) {
      throw new AppError(
        'Station brand/model or brandId/modelId are required',
        400,
        'INVALID_STATION_PAYLOAD',
      );
    }

    return this.resolveCatalogModel(nextBrandName, nextModelName, executor);
  }

  private async getTemplateConnectorPrefill(modelId: string, executor: any = db): Promise<TemplatePrefill | null> {
    const version = await this.connectorsRepository.getLatestTemplateVersion(modelId, executor);

    if (version === null) {
      return null;
    }

    const templateRows = await this.connectorsRepository.listTemplateRows(modelId, version, executor);

    if (templateRows.length === 0) {
      return null;
    }

    return {
      version,
      connectors: normalizeStationConnectors(
        templateRows.map((row: StationModelConnectorTemplateRow) => ({
          connectorNo: row.connectorNo,
          connectorType: row.connectorType,
          currentType: row.currentType,
          powerKw: Number(row.powerKw),
          isActive: row.isActive,
          sortOrder: row.sortOrder,
        })),
      ),
    };
  }

  private toCatalogBrandResponse(brand: BrandRecord): StationCatalogBrandResponse {
    return {
      id: brand.id,
      name: brand.name,
      isActive: brand.isActive,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    };
  }

  private async toCatalogModelResponse(model: ModelRecord): Promise<StationCatalogModelResponse> {
    const templatePrefill = await this.getTemplateConnectorPrefill(model.id);

    return {
      id: model.id,
      brandId: model.brandId,
      name: model.name,
      description: model.description ?? null,
      imageUrl: this.getCatalogModelImageUrl(model),
      logoUrl: null,
      isActive: model.isActive,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
      latestTemplateVersion: templatePrefill?.version ?? null,
      latestTemplateConnectors: templatePrefill?.connectors ?? [],
    };
  }

  private async loadConnectorData(stationRows: StationRecord[]): Promise<ConnectorData> {
    const connectorRows = await this.connectorsRepository.listActiveByStationIds(
      stationRows.map((station) => station.id),
    );
    const connectorsByStationId = new Map<string, StationConnectorResponse[]>();

    for (const row of connectorRows) {
      const current = connectorsByStationId.get(row.stationId) ?? [];
      current.push(this.toConnectorResponse(row));
      connectorsByStationId.set(row.stationId, current);
    }

    const connectorSummaryByStationId = new Map<string, StationConnectorSummary>();

    for (const station of stationRows) {
      const connectors = sortStationConnectorResponses(connectorsByStationId.get(station.id) ?? []);
      connectorsByStationId.set(station.id, connectors);
      connectorSummaryByStationId.set(
        station.id,
        connectors.length > 0 ? buildConnectorSummary(connectors) : this.buildFallbackConnectorSummary(station),
      );
    }

    return {
      connectorsByStationId,
      connectorSummaryByStationId,
    };
  }

  private toConnectorResponse(row: ConnectorRow): StationConnectorResponse {
    return {
      id: row.id,
      connectorNo: row.connectorNo,
      connectorType: row.connectorType,
      currentType: row.currentType,
      powerKw: Number(row.powerKw),
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    };
  }

  private buildFallbackConnectorSummary(station: StationRecord): StationConnectorSummary {
    const rawTypes = station.socketType
      .split(',')
      .map((value) => value.trim())
      .filter((value): value is StationConnectorSummary['types'][number] => value.length > 0);

    return {
      types: rawTypes,
      maxPowerKw: Number(station.powerKw),
      hasAC: station.currentType === 'AC',
      hasDC: station.currentType === 'DC',
      count: 0,
    };
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

  private normalizeCreatePayload(payload: StationCreatePayload): NormalizedStationCreatePayload {
    const lastTestDate = normalizeOptionalDateTime(payload.lastTestDate, 'Last test date');
    const customFields = normalizeOptionalObject(payload.customFields, 'Custom fields', {
      maxKeys: 100,
    });

    return {
      ...payload,
      name: normalizeRequiredField(payload.name, 'Station name', 160, 2),
      code: normalizeRequiredField(payload.code, 'Station code', 80, 2),
      qrCode: normalizeRequiredField(payload.qrCode, 'QR code', 150, 2),
      brandId: normalizeOptionalUuid(payload.brandId, 'Station brand id'),
      modelId: normalizeOptionalUuid(payload.modelId, 'Station model id'),
      brand: payload.brand === undefined ? undefined : normalizeRequiredField(payload.brand, 'Brand', 120, 1),
      model: payload.model === undefined ? undefined : normalizeRequiredField(payload.model, 'Model', 120, 1),
      serialNumber: normalizeRequiredField(payload.serialNumber, 'Serial number', 150, 2),
      location: normalizeRequiredField(payload.location, 'Location', 500, 2),
      lastTestDate:
        lastTestDate === undefined
          ? undefined
          : lastTestDate === null
            ? null
            : lastTestDate.toISOString(),
      notes: normalizeOptionalMultilineText(payload.notes, 'Notes', {
        emptyAs: 'null',
        maxLength: 2000,
      }),
      connectors: payload.connectors === undefined ? undefined : normalizeStationConnectors(payload.connectors),
      customFields: customFields ?? undefined,
    };
  }

  private normalizeUpdatePayload(payload: StationUpdatePayload): NormalizedStationUpdatePayload {
    const lastTestDate = normalizeOptionalDateTime(payload.lastTestDate, 'Last test date');
    const customFields = normalizeOptionalObject(payload.customFields, 'Custom fields', {
      maxKeys: 100,
    });

    return {
      ...payload,
      name: payload.name === undefined ? undefined : normalizeRequiredField(payload.name, 'Station name', 160, 2),
      code: payload.code === undefined ? undefined : normalizeRequiredField(payload.code, 'Station code', 80, 2),
      qrCode: payload.qrCode === undefined ? undefined : normalizeRequiredField(payload.qrCode, 'QR code', 150, 2),
      brandId: normalizeOptionalUuid(payload.brandId, 'Station brand id'),
      modelId: normalizeOptionalUuid(payload.modelId, 'Station model id'),
      brand: payload.brand === undefined ? undefined : normalizeRequiredField(payload.brand, 'Brand', 120, 1),
      model: payload.model === undefined ? undefined : normalizeRequiredField(payload.model, 'Model', 120, 1),
      serialNumber:
        payload.serialNumber === undefined
          ? undefined
          : normalizeRequiredField(payload.serialNumber, 'Serial number', 150, 2),
      location:
        payload.location === undefined
          ? undefined
          : normalizeRequiredField(payload.location, 'Location', 500, 2),
      lastTestDate:
        lastTestDate === undefined
          ? undefined
          : lastTestDate === null
            ? null
            : lastTestDate.toISOString(),
      notes: normalizeOptionalMultilineText(payload.notes, 'Notes', {
        emptyAs: 'null',
        maxLength: 2000,
      }),
      connectors: payload.connectors === undefined ? undefined : normalizeStationConnectors(payload.connectors),
      customFields: customFields ?? undefined,
    };
  }

  private normalizeBrandCreatePayload(payload: StationCatalogBrandCreatePayload) {
    return {
      name: normalizeRequiredField(payload.name, 'Station brand name', 120, 1),
      isActive: payload.isActive,
    };
  }

  private normalizeBrandUpdatePayload(payload: StationCatalogBrandUpdatePayload) {
    return {
      name:
        payload.name === undefined
          ? undefined
          : normalizeRequiredField(payload.name, 'Station brand name', 120, 1),
      isActive: payload.isActive,
    };
  }

  private normalizeModelCreatePayload(payload: StationCatalogModelCreatePayload) {
    return {
      brandId: normalizeRequiredUuid(payload.brandId, 'Station brand id'),
      name: normalizeRequiredField(payload.name, 'Station model name', 120, 1),
      description: normalizeOptionalMultilineText(payload.description, 'Station model description', {
        emptyAs: 'null',
        maxLength: 4000,
      }),
      imageUrl: this.normalizeCatalogModelAssetUrl(payload.imageUrl, 'Station model image URL'),
      logoUrl: this.normalizeCatalogModelAssetUrl(payload.logoUrl, 'Station model logo URL'),
      isActive: payload.isActive,
    };
  }

  private normalizeModelUpdatePayload(payload: StationCatalogModelUpdatePayload) {
    return {
      brandId: normalizeOptionalUuid(payload.brandId, 'Station brand id'),
      name:
        payload.name === undefined
          ? undefined
          : normalizeRequiredField(payload.name, 'Station model name', 120, 1),
      description:
        payload.description === undefined
          ? undefined
          : normalizeOptionalMultilineText(payload.description, 'Station model description', {
              emptyAs: 'null',
              maxLength: 4000,
            }),
      imageUrl:
        payload.imageUrl === undefined
          ? undefined
          : this.normalizeCatalogModelAssetUrl(payload.imageUrl, 'Station model image URL'),
      logoUrl:
        payload.logoUrl === undefined
          ? undefined
          : this.normalizeCatalogModelAssetUrl(payload.logoUrl, 'Station model logo URL'),
      isActive: payload.isActive,
    };
  }

  private normalizeCatalogModelAssetUrl(value: string | null | undefined, label: string) {
    if (value === null) {
      return null;
    }

    return normalizeOptionalSingleLineText(value, label, {
      collapseWhitespace: false,
      emptyAs: 'null',
      maxLength: 2000,
    });
  }

  private getCatalogModelImageUrl(model: ModelRecord): string | null {
    if (model.imageStoragePath) {
      const version = (model.imageUpdatedAt ?? model.updatedAt).toISOString();
      return `/stations/models/${model.id}/image?v=${encodeURIComponent(version)}`;
    }

    return model.imageUrl ?? null;
  }

  private normalizeOptionalPower(value: unknown, label: string) {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_STATION_POWER_KW) {
      throw new AppError(`${label} must be between 0 and ${MAX_STATION_POWER_KW}`, 400, 'INVALID_FILTER');
    }

    return parsed;
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

  private mapStationUniqueConstraintError(error: { constraint?: string }) {
    switch (error.constraint) {
      case 'stations_code_unique':
        return new AppError('Station code already exists', 409, 'STATION_CODE_EXISTS');
      case 'stations_qr_code_unique':
        return new AppError('Station QR code already exists', 409, 'STATION_QR_EXISTS');
      case 'stations_serial_number_unique':
        return new AppError('Station serial number already exists', 409, 'STATION_SERIAL_EXISTS');
      case 'station_connectors_live_station_connector_no_unique':
        return new AppError('Connector number already exists for this station', 400, 'STATION_CONNECTOR_DUPLICATE_NO');
      default:
        return new AppError('Station has duplicate unique fields', 409, 'STATION_DUPLICATE');
    }
  }

  private mapCatalogUniqueConstraintError(error: { constraint?: string }) {
    switch (error.constraint) {
      case 'station_brands_name_unique':
        return new AppError('Station brand name already exists', 409, 'STATION_BRAND_EXISTS');
      case 'station_models_brand_name_unique':
        return new AppError('Station model name already exists for this brand', 409, 'STATION_MODEL_EXISTS');
      default:
        return new AppError('Station catalog has duplicate unique fields', 409, 'STATION_CATALOG_DUPLICATE');
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

  private getSyncMetadata(station: StationRecord, includeConflictFields = false): StationSyncMetadata {
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

  private getCommonStationFields(
    station: StationRecord,
    connectorSummary?: StationConnectorSummary,
  ): StationCommonResponse {
    return {
      id: station.id,
      name: station.name,
      code: station.code,
      qrCode: station.qrCode,
      brandId: station.brandId,
      modelId: station.modelId,
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
      modelTemplateVersion: station.modelTemplateVersion ?? null,
      connectorSummary: connectorSummary ?? this.buildFallbackConnectorSummary(station),
    };
  }

  private toStationListResponse(
    station: StationRecord,
    customFields: Record<string, unknown>,
    connectorSummary?: StationConnectorSummary,
    summary?: StationMobileSummary,
  ): StationFullListItemResponse {
    return {
      ...this.toStationCompactResponse(station, connectorSummary, summary),
      serialNumber: station.serialNumber,
      notes: station.notes,
      createdAt: station.createdAt,
      customFields,
    };
  }

  private toStationCompactResponse(
    station: StationRecord,
    connectorSummary?: StationConnectorSummary,
    summary?: StationMobileSummary,
  ): StationCompactResponse {
    return {
      ...this.getCommonStationFields(station, connectorSummary),
      summary: this.getSummary(summary),
      sync: this.getSyncMetadata(station),
    };
  }

  private toStationSummaryResponse(
    station: StationRecord,
    connectorSummary?: StationConnectorSummary,
    summary?: StationMobileSummary,
  ): StationSummaryResponse {
    return {
      ...this.getCommonStationFields(station, connectorSummary),
      serialNumber: station.serialNumber,
      summary: this.getSummary(summary),
      sync: this.getSyncMetadata(station, true),
    };
  }

  private toStationDetailResponse(
    station: StationRecord,
    customFields: Record<string, unknown>,
    connectors: StationConnectorResponse[],
    connectorSummary?: StationConnectorSummary,
    summary?: StationMobileSummary,
  ): StationDetailResponse {
    return {
      ...this.toStationSummaryResponse(station, connectorSummary, summary),
      notes: station.notes,
      createdAt: station.createdAt,
      connectors,
      customFields,
    };
  }
}

const normalizeRequiredField = (value: string, label: string, maxLength: number, minLength: number) => {
  const normalized =
    normalizeOptionalSingleLineText(value, label, {
      maxLength,
    }) ?? '';

  if (normalized.length < minLength) {
    throw new AppError(`${label} must be at least ${minLength} characters`, 400, 'INVALID_STATION_PAYLOAD');
  }

  return normalized;
};

const normalizeOptionalUuid = (value: string | undefined, label: string) => {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    normalizeOptionalSingleLineText(value, label, {
      collapseWhitespace: false,
      maxLength: 36,
    }) ?? '';

  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new AppError(`${label} must be a valid UUID`, 400, 'INVALID_STATION_PAYLOAD');
  }

  return normalized;
};

const normalizeRequiredUuid = (value: string, label: string) => {
  const normalized = normalizeOptionalUuid(value, label);

  if (!normalized) {
    throw new AppError(`${label} is required`, 400, 'INVALID_STATION_PAYLOAD');
  }

  return normalized;
};

export const stationsService = new StationsService();
