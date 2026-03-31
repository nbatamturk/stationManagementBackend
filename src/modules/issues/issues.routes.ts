import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { assertCanWrite } from '../../utils/rbac';

import {
  issueCreateBodySchema,
  issueDeleteResponseSchema,
  issueIdParamsSchema,
  issueListResponseSchema,
  issueResponseSchema,
  issueStationParamsSchema,
  issueStatusPatchBodySchema,
  issueUpdateBodySchema,
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
      return successResponse(data);
    },
  );

  fastify.post(
    '/stations/:id/issues',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
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
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.get(
    '/issues/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: issueIdParamsSchema,
        response: {
          200: issueResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await issuesService.getById(params.id);
      return successResponse(data);
    },
  );

  fastify.patch(
    '/issues/:id',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        params: issueIdParamsSchema,
        body: issueUpdateBodySchema,
        response: {
          200: issueResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as {
        title?: string;
        description?: string | null;
        severity?: 'low' | 'medium' | 'high' | 'critical';
        status?: 'open' | 'in_progress' | 'resolved' | 'closed';
        assignedTo?: string | null;
      };

      const data = await issuesService.update(getCurrentUserId(request), params.id, body);
      return successResponse(data);
    },
  );

  fastify.patch(
    '/issues/:id/status',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
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
      return successResponse(data);
    },
  );

  fastify.delete(
    '/issues/:id',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        params: issueIdParamsSchema,
        response: {
          200: issueDeleteResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      return issuesService.delete(getCurrentUserId(request), params.id);
    },
  );
};
