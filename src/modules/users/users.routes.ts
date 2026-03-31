import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/api-response';
import { requireRoles } from '../../utils/rbac';

import {
  userActivePatchBodySchema,
  userCreateBodySchema,
  userIdParamsSchema,
  userResponseSchema,
  userUpdateBodySchema,
  usersListQuerySchema,
  usersListResponseSchema,
} from './users.schemas';
import { usersService } from './users.service';

export const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        querystring: usersListQuerySchema,
        response: {
          200: usersListResponseSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as {
        page?: number;
        limit?: number;
        role?: 'admin' | 'operator' | 'viewer';
        isActive?: boolean;
        search?: string;
      };

      return usersService.list({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        role: query.role,
        isActive: query.isActive,
        search: query.search,
      });
    },
  );

  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        params: userIdParamsSchema,
        response: {
          200: userResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await usersService.getSafeUserById(params.id);
      return successResponse(data);
    },
  );

  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        body: userCreateBodySchema,
        response: {
          201: userResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        email: string;
        fullName: string;
        password: string;
        role?: 'admin' | 'operator' | 'viewer';
        isActive?: boolean;
      };

      const data = await usersService.create(body);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.patch(
    '/:id',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        params: userIdParamsSchema,
        body: userUpdateBodySchema,
        response: {
          200: userResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as {
        email?: string;
        fullName?: string;
        password?: string;
        role?: 'admin' | 'operator' | 'viewer';
      };

      const data = await usersService.update(params.id, body);
      return successResponse(data);
    },
  );

  fastify.patch(
    '/:id/active',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        params: userIdParamsSchema,
        body: userActivePatchBodySchema,
        response: {
          200: userResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as { isActive: boolean };

      const data = await usersService.setActive(params.id, body.isActive);
      return successResponse(data);
    },
  );
};
