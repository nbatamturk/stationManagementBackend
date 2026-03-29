import type { FastifyPluginAsync } from 'fastify';

import { getCurrentUserId } from '../../utils/auth';

import {
  issueCreateBodySchema,
  issueIdParamsSchema,
  issueListResponseSchema,
  issueResponseSchema,
  issueStationParamsSchema,
  issueStatusPatchBodySchema,
} from './issues.schemas';
import { issuesService } from './issues.service';

export const issuesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/stations/:id/issues',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: issueStationParamsSchema,
        response: {
          200: issueListResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await issuesService.listByStation(params.id);
      return { data };
    },
  );

  fastify.post(
    '/stations/:id/issues',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: issueStationParamsSchema,
        body: issueCreateBodySchema,
        response: {
          201: issueResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as {
        title: string;
        description?: string;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        assignedTo?: string;
      };

      const data = await issuesService.create(getCurrentUserId(request), params.id, body);
      return reply.status(201).send({ data });
    },
  );

  fastify.patch(
    '/issues/:id/status',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: issueIdParamsSchema,
        body: issueStatusPatchBodySchema,
        response: {
          200: issueResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as { status: 'open' | 'in_progress' | 'resolved' | 'closed' };

      const data = await issuesService.updateStatus(getCurrentUserId(request), params.id, body.status);
      return { data };
    },
  );
};
