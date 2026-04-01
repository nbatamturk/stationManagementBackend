import type { FastifyPluginAsync } from 'fastify';

import { paginatedResponse } from '../../utils/api-response';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { requireRoles } from '../../utils/rbac';

import { auditLogsListQuerySchema, auditLogsListResponseSchema } from './audit-logs.schemas';
import { auditLogsService } from './audit-logs.service';

export const auditLogsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/audit-logs',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Audit Logs'],
        summary: 'List audit logs',
        security: bearerAuthSecurity,
        querystring: auditLogsListQuerySchema,
        response: {
          200: auditLogsListResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 500),
        },
      },
    },
    async (request) => {
      const query = request.query as {
        entityType?: string;
        entityId?: string;
        actorUserId?: string;
        action?: string;
        createdFrom?: string;
        createdTo?: string;
        page?: number;
        limit?: number;
        sortBy?: 'createdAt';
        sortOrder?: 'asc' | 'desc';
      };

      const result = await auditLogsService.list(query);
      return paginatedResponse(result.data, result.meta);
    },
  );
};
