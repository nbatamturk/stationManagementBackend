import fastifyJwt from '@fastify/jwt';
import type { FastifyJWT } from '@fastify/jwt';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { env } from '../config/env';
import { AppError } from '../utils/errors';
import { getRequestSecurityMetadata } from '../utils/security-events';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    signAccessToken: (
      payload: Pick<FastifyJWT['payload'], 'email' | 'role' | 'sub'>,
    ) => string;
  }
}

const getJwtFailureReason = (error: unknown) => {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : null;

  switch (code) {
    case 'FST_JWT_NO_AUTHORIZATION_IN_HEADER':
    case 'FST_JWT_AUTHORIZATION_TOKEN_UNTRUSTED':
      return 'missing_token';
    case 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED':
      return 'expired_token';
    case 'FST_JWT_AUTHORIZATION_TOKEN_INVALID':
    case 'FST_JWT_BAD_REQUEST':
      return 'invalid_token';
    default:
      return 'token_verification_failed';
  }
};

export const authPlugin = fp(async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: {
      expiresIn: env.JWT_EXPIRES_IN,
    },
  });

  fastify.decorate('signAccessToken', (payload: Pick<FastifyJWT['payload'], 'email' | 'role' | 'sub'>) =>
    fastify.jwt.sign({
      ...payload,
      sessionVersion: 1,
      typ: 'access',
    }),
  );

  fastify.decorate('authenticate', async (request: FastifyRequest) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      const reason = getJwtFailureReason(error);

      if (reason !== 'missing_token') {
        await fastify.auditSecurityEvent({
          action: 'auth.token.rejected',
          metadataJson: {
            ...getRequestSecurityMetadata(request),
            reason,
          },
        });
      }

      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }

    if (request.user.typ && request.user.typ !== 'access') {
      await fastify.auditSecurityEvent({
        action: 'auth.token.rejected',
        actorUserId: request.user.sub,
        metadataJson: {
          ...getRequestSecurityMetadata(request),
          reason: 'invalid_token_type',
          tokenType: request.user.typ,
        },
      });

      throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
    }
  });
});
