import type { FastifyPluginAsync } from 'fastify';

import { paginatedResponse, successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { assertCanWrite, requireRoles } from '../../utils/rbac';
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
import { stationsService } from './stations.service';

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
          'Returns a paginated station list. Use `view=compact` for mobile-friendly items, `updatedFrom` for incremental refresh, and `code`, `qrCode`, or `ids` for exact-match lookups. `status` is operational-only; archive lifecycle is represented by `isArchived`. Date filters use ISO 8601 UTC strings. Custom field filters use the `cf.<key>=<value>` query parameter convention.',
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
    '/summary/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Stations'],
        summary: 'Get a mobile station summary by id',
        description:
          'Returns a lightweight station payload with station identifiers, counts, and sync metadata for mobile detail headers or cache refresh flows.',
        security: bearerAuthSecurity,
        params: stationIdParamsSchema,
        response: {
          200: stationSummaryResponseSchema,
          ...pickErrorResponseSchemas(401, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.getSummaryById(params.id);
      return successResponse(data);
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
          'Returns the full station detail payload, including custom fields plus mobile-oriented summary and sync metadata.',
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
        logoUrl?: string | null;
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
        logoUrl?: string | null;
        isActive?: boolean;
      };

      const data = await stationsService.updateModel(getCurrentUserId(request), params.id, body);
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
