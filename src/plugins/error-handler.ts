import fp from 'fastify-plugin';

import { AppError, isAppError } from '../utils/errors';

export const errorHandlerPlugin = fp(async (fastify) => {
  fastify.setErrorHandler((error, _request, reply) => {
    if (isAppError(error)) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        details: error.details ?? null,
      });
    }

    if (typeof error === 'object' && error !== null && 'validation' in error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      return reply.status(400).send({
        code: 'VALIDATION_ERROR',
        message,
      });
    }

    fastify.log.error(error);

    const fallbackError = new AppError('Unexpected internal server error', 500, 'INTERNAL_ERROR');

    return reply.status(fallbackError.statusCode).send({
      code: fallbackError.code,
      message: fallbackError.message,
    });
  });

  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({
      code: 'NOT_FOUND',
      message: 'Route not found',
    });
  });
});
