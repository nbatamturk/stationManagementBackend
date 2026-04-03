import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { requireRoles } from '../../utils/rbac';
import { strictWriteRouteOptions } from '../../utils/strict-validator';

import {
  customFieldCreateBodySchema,
  customFieldDeleteResponseSchema,
  customFieldIdParamsSchema,
  customFieldListQuerySchema,
  customFieldListResponseSchema,
  customFieldResponseSchema,
  customFieldSetActiveBodySchema,
  customFieldUpdateBodySchema,
} from './custom-fields.schemas';
import { customFieldsService } from './custom-fields.service';

export const customFieldsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Custom Fields'],
        summary: 'List custom field definitions',
        description: 'Returns canonical custom field definitions. JSON option payloads are exposed as `options` in the API contract.',
        security: bearerAuthSecurity,
        querystring: customFieldListQuerySchema,
        response: {
          200: customFieldListResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 500),
        },
      },
    },
    async (request) => {
      const query = request.query as { isActive?: boolean };
      const data = await customFieldsService.list(query.isActive);
      return successResponse(data);
    },
  );

  fastify.post(
    '/',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Custom Fields'],
        summary: 'Create a custom field definition',
        security: bearerAuthSecurity,
        body: customFieldCreateBodySchema,
        response: {
          201: customFieldResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 409, 500),
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        key: string;
        label: string;
        type: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
        options?: Record<string, unknown>;
        isRequired?: boolean;
        isFilterable?: boolean;
        isVisibleInList?: boolean;
        sortOrder?: number;
        isActive?: boolean;
      };

      const data = await customFieldsService.create(getCurrentUserId(request), body);
      return reply.status(201).send(successResponse(data));
    },
  );

  fastify.put(
    '/:id',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Custom Fields'],
        summary: 'Update a custom field definition',
        security: bearerAuthSecurity,
        params: customFieldIdParamsSchema,
        body: customFieldUpdateBodySchema,
        response: {
          200: customFieldResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as {
        label: string;
        type: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
        options?: Record<string, unknown>;
        isRequired: boolean;
        isFilterable: boolean;
        isVisibleInList: boolean;
        sortOrder: number;
      };

      const data = await customFieldsService.update(getCurrentUserId(request), params.id, body);
      return successResponse(data);
    },
  );

  fastify.patch(
    '/:id/active',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Custom Fields'],
        summary: 'Set custom field active state',
        security: bearerAuthSecurity,
        params: customFieldIdParamsSchema,
        body: customFieldSetActiveBodySchema,
        response: {
          200: customFieldResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 403, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as { isActive: boolean };

      const data = await customFieldsService.setActive(getCurrentUserId(request), params.id, body.isActive);
      return successResponse(data);
    },
  );

  fastify.delete(
    '/:id',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Custom Fields'],
        summary: 'Delete a custom field definition',
        security: bearerAuthSecurity,
        params: customFieldIdParamsSchema,
        response: {
          200: customFieldDeleteResponseSchema,
          ...pickErrorResponseSchemas(401, 403, 404, 500),
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const data = await customFieldsService.delete(getCurrentUserId(request), params.id);
      return successResponse(data);
    },
  );
};
