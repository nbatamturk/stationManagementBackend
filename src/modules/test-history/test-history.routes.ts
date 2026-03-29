import type { FastifyPluginAsync } from 'fastify';

import { getCurrentUserId } from '../../utils/auth';

import {
  testHistoryCreateBodySchema,
  testHistoryListResponseSchema,
  testHistoryResponseSchema,
  testHistoryStationParamsSchema,
} from './test-history.schemas';
import { testHistoryService } from './test-history.service';

export const testHistoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/stations/:id/test-history',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: testHistoryStationParamsSchema,
        response: {
          200: testHistoryListResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await testHistoryService.listByStation(params.id);
      return { data };
    },
  );

  fastify.post(
    '/stations/:id/test-history',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: testHistoryStationParamsSchema,
        body: testHistoryCreateBodySchema,
        response: {
          201: testHistoryResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as {
        testDate?: string;
        result: 'pass' | 'fail' | 'warning';
        notes?: string;
        metricsJson?: Record<string, unknown>;
      };

      const data = await testHistoryService.create(getCurrentUserId(request), params.id, body);
      return reply.status(201).send({ data });
    },
  );
};
