import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/api-response';
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
        response: {
          200: dashboardSummaryResponseSchema,
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
        querystring: dashboardRecentStationsQuerySchema,
        response: {
          200: dashboardRecentStationsResponseSchema,
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
        querystring: dashboardRecentIssuesQuerySchema,
        response: {
          200: dashboardRecentIssuesResponseSchema,
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
        querystring: dashboardRecentTestsQuerySchema,
        response: {
          200: dashboardRecentTestsResponseSchema,
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
