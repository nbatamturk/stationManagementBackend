import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { assertCanWrite } from '../../utils/rbac';

import {
  testHistoryCreateBodySchema,
  testHistoryDeleteResponseSchema,
  testHistoryIdParamsSchema,
  testHistoryListResponseSchema,
  testHistoryResponseSchema,
  testHistoryStationParamsSchema,
  testHistoryUpdateBodySchema,
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
      return successResponse(data);
    },
  );

  fastify.post(
    '/stations/:id/test-history',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
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
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.patch(
    '/test-history/:id',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        params: testHistoryIdParamsSchema,
        body: testHistoryUpdateBodySchema,
        response: {
          200: testHistoryResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as {
        testDate?: string;
        result?: 'pass' | 'fail' | 'warning';
        notes?: string | null;
        metricsJson?: Record<string, unknown>;
      };

      const data = await testHistoryService.update(getCurrentUserId(request), params.id, body);
      return successResponse(data);
    },
  );

  fastify.delete(
    '/test-history/:id',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        params: testHistoryIdParamsSchema,
        response: {
          200: testHistoryDeleteResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      return testHistoryService.delete(getCurrentUserId(request), params.id);
    },
  );
};
