import type { FastifyPluginAsync } from 'fastify';

import { successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { AppError } from '../../utils/errors';
import { normalizeEmail } from '../../utils/input';
import { bearerAuthSecurity, pickErrorResponseSchemas } from '../../utils/api-schemas';
import { fingerprintValue, getRequestSecurityMetadata, maskEmail } from '../../utils/security-events';

import { isAuthenticationError } from './auth.errors';
import { authService } from './auth.service';
import { loginBodySchema, loginResponseSchema, meResponseSchema } from './auth.schemas';
import { loginAttemptGuard } from './login-attempt-guard';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Authenticate and receive a bearer token',
        description:
          'Authenticates a user with email and password. The returned `accessToken` must be sent as `Authorization: Bearer <accessToken>` on protected routes. Frontend clients should treat the `expiresIn` value as the token lifetime contract.',
        body: loginBodySchema,
        response: {
          200: loginResponseSchema,
          ...pickErrorResponseSchemas(400, 401, 429, 500),
        },
      },
    },
    async (request) => {
      const body = request.body as {
        email: string;
        password: string;
      };
      const normalizedEmail = normalizeEmail(body.email);
      const attemptKey = `${request.ip}:${normalizedEmail}`;
      const securityMetadata = {
        ...getRequestSecurityMetadata(request),
        emailFingerprint: fingerprintValue(normalizedEmail),
        emailMasked: maskEmail(normalizedEmail),
      };
      const attemptStatus = loginAttemptGuard.getStatus(attemptKey);

      if (attemptStatus.blocked) {
        request.log.warn(
          {
            ...securityMetadata,
            event: 'auth.login.blocked',
            retryAfterSeconds: attemptStatus.retryAfterSeconds,
          },
          'Blocked login attempt rejected',
        );

        await request.server.auditSecurityEvent({
          action: 'auth.login.blocked',
          metadataJson: {
            ...securityMetadata,
            retryAfterSeconds: attemptStatus.retryAfterSeconds,
          },
        });

        throw new AppError('Too many login attempts. Try again later.', 429, 'LOGIN_RATE_LIMITED', {
          retryAfterSeconds: attemptStatus.retryAfterSeconds,
        });
      }

      try {
        const data = await authService.login(body, fastify.signAccessToken);
        loginAttemptGuard.reset(attemptKey);

        await request.server.auditSecurityEvent({
          action: 'auth.login.succeeded',
          actorUserId: data.user.id,
          metadataJson: securityMetadata,
        });

        return successResponse(data);
      } catch (error) {
        if (isAuthenticationError(error)) {
          const failure = loginAttemptGuard.recordFailure(attemptKey);
          const eventName = failure.blocked ? 'auth.login.blocked' : 'auth.login.failed';

          request.log.warn(
            {
              ...securityMetadata,
              attemptCount: failure.attempts,
              event: eventName,
              reason: error.reason,
              retryAfterSeconds: failure.retryAfterSeconds,
            },
            failure.blocked ? 'Login blocked after repeated failures' : 'Login failed',
          );

          await request.server.auditSecurityEvent({
            action: eventName,
            metadataJson: {
              ...securityMetadata,
              attemptCount: failure.attempts,
              reason: error.reason,
              retryAfterSeconds: failure.retryAfterSeconds,
            },
          });

          if (failure.blocked) {
            throw new AppError('Too many login attempts. Try again later.', 429, 'LOGIN_RATE_LIMITED', {
              retryAfterSeconds: failure.retryAfterSeconds,
            });
          }
        }

        throw error;
      }
    },
  );

  fastify.get(
    '/me',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Get the authenticated user',
        description: 'Resolves the current user from the bearer token and returns the safe user payload for UI session hydration.',
        security: bearerAuthSecurity,
        response: {
          200: meResponseSchema,
          ...pickErrorResponseSchemas(401, 404, 500),
        },
      },
    },
    async (request) => {
      const data = await authService.me(getCurrentUserId(request));
      return successResponse(data);
    },
  );
};
