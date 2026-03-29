import type { FastifyPluginAsync } from 'fastify';

import { getCurrentUserId } from '../../utils/auth';

import { authService } from './auth.service';
import { loginBodySchema, loginResponseSchema, meResponseSchema } from './auth.schemas';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/login',
    {
      schema: {
        body: loginBodySchema,
        response: {
          200: loginResponseSchema,
        },
      },
    },
    async (request) => {
      const body = request.body as {
        email: string;
        password: string;
      };

      return authService.login(body, (payload) => fastify.jwt.sign(payload));
    },
  );

  fastify.get(
    '/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        response: {
          200: meResponseSchema,
        },
      },
    },
    async (request) => {
      return authService.me(getCurrentUserId(request));
    },
  );
};
