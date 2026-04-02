import type { FastifyPluginAsync } from 'fastify';

import { paginatedResponse, successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { requireRoles } from '../../utils/rbac';
import { strictWriteRouteOptions } from '../../utils/strict-validator';

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
        tags: ['Users'],
        summary: 'List users',
        security: bearerAuthSecurity,
        querystring: usersListQuerySchema,
        response: {
          200: usersListResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 500),
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

      const result = await usersService.list({
        page: query.page ?? 1,
        limit: query.limit ?? 20,
        role: query.role,
        isActive: query.isActive,
        search: query.search,
      });

      return paginatedResponse(result.data, result.meta);
    },
  );

  fastify.get(
    '/:id',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Get a user by id',
        security: bearerAuthSecurity,
        params: userIdParamsSchema,
        response: {
          200: userResponseSchema,
          ...pickErrorResponseSchemas(401, 403, 404, 500),
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
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Create a user',
        security: bearerAuthSecurity,
        body: userCreateBodySchema,
        response: {
          201: userResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 409, 500),
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

      const data = await usersService.create(getCurrentUserId(request), body);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.patch(
    '/:id',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Update a user',
        security: bearerAuthSecurity,
        params: userIdParamsSchema,
        body: userUpdateBodySchema,
        response: {
          200: userResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 409, 500),
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

      const data = await usersService.update(getCurrentUserId(request), params.id, body);
      return successResponse(data);
    },
  );

  fastify.patch(
    '/:id/active',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Users'],
        summary: 'Set user active state',
        security: bearerAuthSecurity,
        params: userIdParamsSchema,
        body: userActivePatchBodySchema,
        response: {
          200: userResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as { isActive: boolean };

      const data = await usersService.setActive(getCurrentUserId(request), params.id, body.isActive);
      return successResponse(data);
    },
  );
};
