import type { FastifyPluginAsync } from 'fastify';

import { paginatedResponse, successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { assertCanWrite } from '../../utils/rbac';

import {
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
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Stations'],
        summary: 'List stations',
        description:
          'Returns a paginated station list. Use `view=compact` for mobile-friendly items, `updatedSince` for incremental refresh, and `code`, `qrCode`, or `ids` for exact-match lookups. Date filters use ISO 8601 UTC strings. Custom field filters use the `cf.<key>=<value>` query parameter convention.',
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
    '/',
    {
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

      const data = await stationsService.create(getCurrentUserId(request), body);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.put(
    '/:id',
    {
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
        brand?: string;
        model?: string;
        serialNumber?: string;
        powerKw?: number;
        currentType?: 'AC' | 'DC';
        socketType?: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
        location?: string;
        status?: 'active' | 'maintenance' | 'inactive' | 'faulty' | 'archived';
        lastTestDate?: string;
        notes?: string;
        customFields?: Record<string, unknown>;
      };

      const data = await stationsService.update(getCurrentUserId(request), params.id, body);
      return successResponse(data);
    },
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
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
      preHandler: [fastify.authenticate, assertCanWrite],
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
