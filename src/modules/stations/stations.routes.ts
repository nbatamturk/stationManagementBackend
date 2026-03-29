import type { FastifyPluginAsync } from 'fastify';

import { getCurrentUserId } from '../../utils/auth';

import {
  stationCreateBodySchema,
  stationDeleteResponseSchema,
  stationIdParamsSchema,
  stationListQuerySchema,
  stationListResponseSchema,
  stationResponseSchema,
  stationUpdateBodySchema,
} from './stations.schemas';
import { stationsService } from './stations.service';

export const stationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: stationListQuerySchema,
        response: {
          200: stationListResponseSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as Record<string, unknown>;
      const data = await stationsService.list(query);
      return { data };
    },
  );

  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: stationIdParamsSchema,
        response: {
          200: stationResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.getById(params.id);
      return { data };
    },
  );

  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: stationCreateBodySchema,
        response: {
          201: stationResponseSchema,
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
      return reply.status(201).send({ data });
    },
  );

  fastify.put(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: stationIdParamsSchema,
        body: stationUpdateBodySchema,
        response: {
          200: stationResponseSchema,
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
      return { data };
    },
  );

  fastify.delete(
    '/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: stationIdParamsSchema,
        response: {
          200: stationDeleteResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      return stationsService.delete(getCurrentUserId(request), params.id);
    },
  );

  fastify.post(
    '/:id/archive',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: stationIdParamsSchema,
        response: {
          200: stationResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await stationsService.archive(getCurrentUserId(request), params.id);
      return { data };
    },
  );
};
