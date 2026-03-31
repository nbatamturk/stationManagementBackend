import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { assertCanWrite } from '../../utils/rbac';

import {
  customFieldCreateBodySchema,
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
        querystring: customFieldListQuerySchema,
        response: {
          200: customFieldListResponseSchema,
        },
      },
    },
    async (request) => {
      const query = request.query as { active?: boolean };
      const data = await customFieldsService.list(query.active);
      return successResponse(data);
    },
  );

  fastify.post(
    '/',
    {
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        body: customFieldCreateBodySchema,
        response: {
          201: customFieldResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        key: string;
        label: string;
        type: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
        optionsJson?: Record<string, unknown>;
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
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        params: customFieldIdParamsSchema,
        body: customFieldUpdateBodySchema,
        response: {
          200: customFieldResponseSchema,
        },
      },
    },
    async (request) => {
      const params = request.params as { id: string };
      const body = request.body as {
        label: string;
        type: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
        optionsJson?: Record<string, unknown>;
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
      preHandler: [fastify.authenticate, assertCanWrite],
      schema: {
        params: customFieldIdParamsSchema,
        body: customFieldSetActiveBodySchema,
        response: {
          200: customFieldResponseSchema,
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
};
