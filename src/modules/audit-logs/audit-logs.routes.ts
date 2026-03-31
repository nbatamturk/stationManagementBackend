import type { FastifyPluginAsync } from 'fastify';

import { paginatedResponse } from '../../utils/api-response';
import { requireRoles } from '../../utils/rbac';

import { auditLogsListQuerySchema, auditLogsListResponseSchema } from './audit-logs.schemas';
import { auditLogsService } from './audit-logs.service';

export const auditLogsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/audit-logs',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        querystring: auditLogsListQuerySchema,
        response: {
          200: auditLogsListResponseSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as {
        entityType?: string;
        entityId?: string;
        actorUserId?: string;
        action?: string;
        fromDate?: string;
        toDate?: string;
        page?: number;
        limit?: number;
      };

      const result = await auditLogsService.list(query);
      return paginatedResponse(result.data, result.meta);
    },
  );
};
