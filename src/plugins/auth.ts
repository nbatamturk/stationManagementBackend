import fastifyJwt from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../config/env';
import { AppError } from '../utils/errors';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  fastify.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch {
      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
  });
});
