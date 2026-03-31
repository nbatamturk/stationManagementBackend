import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/api-response';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { requireRoles } from '../../utils/rbac';

import {
  dashboardRecentIssuesQuerySchema,
  dashboardRecentIssuesResponseSchema,
  dashboardRecentStationsQuerySchema,
  dashboardRecentStationsResponseSchema,
  dashboardRecentTestsQuerySchema,
  dashboardRecentTestsResponseSchema,
  dashboardSummaryResponseSchema,
} from './dashboard.schemas';
import { dashboardService } from './dashboard.service';

export const dashboardRoutes: FastifyPluginAsync = async (fastify) => {
  const authz = [fastify.authenticate, requireRoles(['admin'])];

  fastify.get(
    '/dashboard/summary',
    {
      preHandler: authz,
      schema: {
        tags: ['Dashboard'],
        summary: 'Get dashboard summary metrics',
        security: bearerAuthSecurity,
        response: {
          200: dashboardSummaryResponseSchema,
          ...pickErrorResponseSchemas(401, 403, 500),
        },
      },
    },
    async () => {
      const data = await dashboardService.getSummary();
      return successResponse(data);
    },
  );

  fastify.get(
    '/dashboard/recent-stations',
    {
      preHandler: authz,
      schema: {
        tags: ['Dashboard'],
        summary: 'List recently updated stations',
        security: bearerAuthSecurity,
        querystring: dashboardRecentStationsQuerySchema,
        response: {
          200: dashboardRecentStationsResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 500),
        },
      },
    },
    async (request) => {
      const query = request.query as { limit?: number };
      const data = await dashboardService.getRecentStations(query.limit);
      return successResponse(data);
    },
  );

  fastify.get(
    '/dashboard/recent-issues',
    {
      preHandler: authz,
      schema: {
        tags: ['Dashboard'],
        summary: 'List recent issues',
        security: bearerAuthSecurity,
        querystring: dashboardRecentIssuesQuerySchema,
        response: {
          200: dashboardRecentIssuesResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 500),
        },
      },
    },
    async (request) => {
      const query = request.query as { limit?: number };
      const data = await dashboardService.getRecentIssues(query.limit);
      return successResponse(data);
    },
  );

  fastify.get(
    '/dashboard/recent-tests',
    {
      preHandler: authz,
      schema: {
        tags: ['Dashboard'],
        summary: 'List recent tests',
        security: bearerAuthSecurity,
        querystring: dashboardRecentTestsQuerySchema,
        response: {
          200: dashboardRecentTestsResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 500),
        },
      },
    },
    async (request) => {
      const query = request.query as { limit?: number };
      const data = await dashboardService.getRecentTests(query.limit);
      return successResponse(data);
    },
  );
};
