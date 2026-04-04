import { createReadStream } from 'node:fs';

import { Type } from '@sinclair/typebox';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { paginatedResponse, successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { AppError } from '../../utils/errors';
import { assertCanWrite, requireRoles } from '../../utils/rbac';
import { getRequestSecurityMetadata, writeSecurityEvent } from '../../utils/security-events';
import { strictWriteRouteOptions } from '../../utils/strict-validator';

import {
  stationCatalogBrandCreateBodySchema,
  stationCatalogDeleteResponseSchema,
  stationCatalogBrandResponseSchema,
  stationCatalogBrandUpdateBodySchema,
  stationCatalogModelCreateBodySchema,
  stationCatalogModelResponseSchema,
  stationCatalogModelTemplateUpdateBodySchema,
  stationCatalogModelUpdateBodySchema,
  stationConfigResponseSchema,
  stationCreateBodySchema,
  stationDeleteResponseSchema,
  stationIdParamsSchema,
  stationListQuerySchema,
  stationListResponseSchema,
  stationQrLookupParamsSchema,
  stationResponseSchema,
  stationSummaryResponseSchema,
  stationUpdateBodySchema,
} from './stations.schemas';
import { modelImageMaxFileSizeBytes } from './station-model-images.storage';
import { stationsService } from './stations.service';

type StationModelImageUploadPayload = {
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};

const modelImageDownloadResponseSchema = Type.String({
  description: 'Binary station model image contents. The actual response content type depends on the normalized stored image MIME type.',
});

const mapModelImageMultipartError = (request: FastifyRequest, error: unknown) => {
  if (error instanceof request.server.multipartErrors.RequestFileTooLargeError) {
    throw new AppError(
      `Station model image exceeds maximum size of ${Math.floor(modelImageMaxFileSizeBytes / (1024 * 1024))} MB`,
      413,
      'STATION_MODEL_IMAGE_TOO_LARGE',
      {
        maxFileSizeBytes: modelImageMaxFileSizeBytes,
      },
    );
  }

  if (error instanceof request.server.multipartErrors.FilesLimitError) {
    throw new AppError('Only one station model image file is allowed', 400, 'INVALID_STATION_MODEL_IMAGE_UPLOAD');
  }

  if (error instanceof request.server.multipartErrors.FieldsLimitError) {
    throw new AppError('Station model image upload cannot include extra form fields', 400, 'INVALID_STATION_MODEL_IMAGE_UPLOAD');
  }

  if (error instanceof request.server.multipartErrors.PartsLimitError) {
    throw new AppError('Station model image upload contains too many form parts', 400, 'INVALID_STATION_MODEL_IMAGE_UPLOAD');
  }

  throw error;
};

const readModelImageUpload = async (request: FastifyRequest): Promise<StationModelImageUploadPayload> => {
  if (!request.isMultipart()) {
    throw new AppError('Station model image upload must use multipart/form-data with a file field', 400, 'INVALID_STATION_MODEL_IMAGE_UPLOAD');
  }

  let part;

  try {
    part = await request.file({
      throwFileSizeLimit: true,
      limits: {
        fields: 0,
        files: 1,
        fileSize: modelImageMaxFileSizeBytes,
        parts: 1,
      },
    });
  } catch (error) {
    mapModelImageMultipartError(request, error);
  }

  if (!part) {
    throw new AppError('Station model image file is required', 400, 'INVALID_STATION_MODEL_IMAGE_UPLOAD');
  }

  if (part.fieldname !== 'file') {
    part.file.resume();
    throw new AppError('Station model image upload must use a file field named "file"', 400, 'INVALID_STATION_MODEL_IMAGE_UPLOAD');
  }

  try {
    const buffer = await part.toBuffer();

    return {
      originalFileName: part.filename,
      mimeType: part.mimetype,
      sizeBytes: buffer.byteLength,
      buffer,
    };
  } catch (error) {
    mapModelImageMultipartError(request, error);
    throw error;
  }
};

const logRejectedModelImageUpload = async (
  request: FastifyRequest,
  modelId: string,
  error: unknown,
) => {
  const actorUserId = getCurrentUserId(request);
  const appError = error instanceof AppError ? error : null;

  await writeSecurityEvent({
    actorUserId,
    entityType: 'station_model',
    entityId: modelId,
    action: 'station_model.image_upload_rejected',
    metadataJson: {
      ...getRequestSecurityMetadata(request),
      errorCode: appError?.code ?? 'UNKNOWN_ERROR',
      errorMessage: appError?.message ?? 'Unknown station model image upload failure',
    },
  });
};

export const stationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/config',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Stations'],
        summary: 'Get station catalog and form configuration',
        description:
          'Returns the catalog-backed station configuration used by admin-web forms, including brands, models, and the latest connector template snapshot for each model.',
        security: bearerAuthSecurity,
        response: {
          200: stationConfigResponseSchema,
          ...pickErrorResponseSchemas(401, 500),
        },
      },
    },
    async () => {
      const data = await stationsService.getConfig();
      return successResponse(data);
    },
  );

  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Stations'],
        summary: 'List stations',
        description:
          'Returns a paginated station list. Use `view=compact` for mobile-friendly items and `code`, `qrCode`, or `ids` for exact-match lookups. `status` is operational-only; archive lifecycle is represented by `isArchived`. Date filters use ISO 8601 UTC strings. Custom field filters use the `cf.<key>=<value>` query parameter convention.',
        security: bearerAuthSecurity,
        querystring: stationListQuerySchema,
        response: {
          200: stationListResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 500),
        },
      },
    },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const result = await stationsService.list(query);
      return paginatedResponse(result.data, result.meta);
    },
  );

  fastify.get(
    '/lookup/qr/:value',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Stations'],
        summary: 'Lookup a station by QR value',
        description:
          'Returns a lightweight station payload for QR scan flows. The response is intentionally smaller than the full station detail endpoint.',
        security: bearerAuthSecurity,
        params: stationQrLookupParamsSchema,
        response: {
          200: stationSummaryResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { value: string };
      const data = await stationsService.lookupByQrCode(params.value);
      return successResponse(data);
    },
  );

  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Stations'],
        summary: 'Get a station by id',
        description:
          'Returns the full station detail payload, including custom fields and station summary metadata.',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        response: {
          200: stationResponseSchema,
          ...pickErrorResponseSchemas(401, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.getById(params.id);
      return successResponse(data);
    },
  );

  fastify.post(
    '/brands',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Create a station brand',
        security: bearerAuthSecurity,
        body: stationCatalogBrandCreateBodySchema,
        response: {
          201: stationCatalogBrandResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 409, 500),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        isActive?: boolean;
      };

      const data = await stationsService.createBrand(getCurrentUserId(request), body);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.put(
    '/brands/:id',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Update a station brand',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        body: stationCatalogBrandUpdateBodySchema,
        response: {
          200: stationCatalogBrandResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 409, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as {
        name?: string;
        isActive?: boolean;
      };

      const data = await stationsService.updateBrand(getCurrentUserId(request), params.id, body);
      return successResponse(data);
    },
  );

  fastify.delete(
    '/brands/:id',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Delete a station brand',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        response: {
          200: stationCatalogDeleteResponseSchema,
          ...pickErrorResponseSchemas(401, 403, 404, 409, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.deleteBrand(getCurrentUserId(request), params.id);
      return successResponse(data);
    },
  );

  fastify.post(
    '/models',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Create a station model',
        security: bearerAuthSecurity,
        body: stationCatalogModelCreateBodySchema,
        response: {
          201: stationCatalogModelResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 409, 500),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        brandId: string;
        name: string;
        description?: string | null;
        imageUrl?: string | null;
        isActive?: boolean;
      };

      const data = await stationsService.createModel(getCurrentUserId(request), body);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.put(
    '/models/:id',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Update a station model',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        body: stationCatalogModelUpdateBodySchema,
        response: {
          200: stationCatalogModelResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 409, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as {
        brandId?: string;
        name?: string;
        description?: string | null;
        imageUrl?: string | null;
        isActive?: boolean;
      };

      const data = await stationsService.updateModel(getCurrentUserId(request), params.id, body);
      return successResponse(data);
    },
  );

  fastify.get(
    '/models/:id/image',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Stations'],
        summary: 'Download a station model image',
        description: 'Streams the normalized, backend-managed station model image to authenticated clients.',
        security: bearerAuthSecurity,
        produces: ['image/jpeg', 'image/png'],
        params: stationIdParamsSchema,
        response: {
          200: modelImageDownloadResponseSchema,
          ...pickErrorResponseSchemas(401, 404, 500),
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const download = await stationsService.prepareModelImageDownload(getCurrentUserId(request), params.id);

      reply.header('content-type', download.mimeType);
      reply.header('content-length', String(download.sizeBytes));
      reply.header('content-disposition', download.contentDisposition);
      reply.header('cache-control', 'private, max-age=300');
      reply.header('x-content-type-options', 'nosniff');

      return reply.send(createReadStream(download.absolutePath));
    },
  );

  fastify.put(
    '/models/:id/image',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Upload or replace a station model image',
        description: 'Upload a single normalized station model image using `multipart/form-data` with a `file` field.',
        security: bearerAuthSecurity,
        consumes: ['multipart/form-data'],
        params: stationIdParamsSchema,
        response: {
          200: stationCatalogModelResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 413, 415, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };

      try {
        const upload = await readModelImageUpload(request);
        const data = await stationsService.uploadModelImage(getCurrentUserId(request), params.id, upload);
        return successResponse(data);
      } catch (error) {
        if (error instanceof AppError && error.statusCode >= 400 && error.statusCode < 500) {
          await logRejectedModelImageUpload(request, params.id, error);
        }

        throw error;
      }
    },
  );

  fastify.delete(
    '/models/:id/image',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Delete a station model image',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        response: {
          200: stationCatalogDeleteResponseSchema,
          ...pickErrorResponseSchemas(401, 403, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.deleteModelImage(getCurrentUserId(request), params.id);
      return successResponse(data);
    },
  );

  fastify.delete(
    '/models/:id',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Delete a station model',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        response: {
          200: stationCatalogDeleteResponseSchema,
          ...pickErrorResponseSchemas(401, 403, 404, 409, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.deleteModel(getCurrentUserId(request), params.id);
      return successResponse(data);
    },
  );

  fastify.put(
    '/models/:id/template',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Replace the latest station model connector template',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        body: stationCatalogModelTemplateUpdateBodySchema,
        response: {
          200: stationCatalogModelResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 409, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as {
        connectors: Array<{
          connectorNo: number;
          connectorType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
          currentType: 'AC' | 'DC';
          powerKw: number;
          isActive?: boolean;
          sortOrder?: number;
        }>;
      };

      const data = await stationsService.replaceModelTemplate(getCurrentUserId(request), params.id, body);
      return successResponse(data);
    },
  );

  fastify.post(
    '/',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        tags: ['Stations'],
        summary: 'Create a station',
        security: bearerAuthSecurity,
        body: stationCreateBodySchema,
        response: {
          201: stationResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 409, 500),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        name: string;
        code: string;
        qrCode: string;
        brandId?: string;
        modelId?: string;
        brand?: string;
        model?: string;
        serialNumber: string;
        location: string;
        status?: 'active' | 'maintenance' | 'inactive' | 'faulty';
        lastTestDate?: string | null;
        notes?: string | null;
        connectors?: Array<{
          connectorNo: number;
          connectorType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
          currentType: 'AC' | 'DC';
          powerKw: number;
          isActive?: boolean;
          sortOrder?: number;
        }>;
        customFields?: Record<string, unknown>;
      };

      const data = await stationsService.create(getCurrentUserId(request), body);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.put(
    '/:id',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        tags: ['Stations'],
        summary: 'Update a station',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        body: stationUpdateBodySchema,
        response: {
          200: stationResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 409, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as {
        name?: string;
        code?: string;
        qrCode?: string;
        brandId?: string;
        modelId?: string;
        brand?: string;
        model?: string;
        serialNumber?: string;
        location?: string;
        status?: 'active' | 'maintenance' | 'inactive' | 'faulty';
        lastTestDate?: string | null;
        notes?: string | null;
        connectors?: Array<{
          connectorNo: number;
          connectorType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
          currentType: 'AC' | 'DC';
          powerKw: number;
          isActive?: boolean;
          sortOrder?: number;
        }>;
        customFields?: Record<string, unknown>;
      };

      const data = await stationsService.update(getCurrentUserId(request), params.id, body);
      return successResponse(data);
    },
  );

  fastify.post(
    '/:id/apply-model-template',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        tags: ['Stations'],
        summary: 'Apply the latest model connector template to a station',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        response: {
          200: stationResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.applyModelTemplate(getCurrentUserId(request), params.id);
      return successResponse(data);
    },
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Delete a station',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        response: {
          200: stationDeleteResponseSchema,
          ...pickErrorResponseSchemas(401, 403, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.delete(getCurrentUserId(request), params.id);
      return successResponse(data);
    },
  );

  fastify.post(
    '/:id/archive',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Stations'],
        summary: 'Archive a station',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        response: {
          200: stationResponseSchema,
          ...pickErrorResponseSchemas(401, 403, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.archive(getCurrentUserId(request), params.id);
      return successResponse(data);
    },
  );
};
