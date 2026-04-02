import fp from 'fastify-plugin';

import { errorResponse } from '../utils/api-response';
import { AppError, isAppError } from '../utils/errors';

export const errorHandlerPlugin = fp(async (fastify) => {
  fastify.setErrorHandler((error, request, reply) => {
    if (isAppError(error)) {
      if (error.statusCode >= 500) {
        request.log.error(
          {
            code: error.code,
            err: error,
          },
          'Application error',
        );
      } else if (error.statusCode !== 401 && error.statusCode !== 403) {
        request.log.info(
          {
            code: error.code,
            details: error.details ?? null,
            statusCode: error.statusCode,
          },
          'Request rejected',
        );
      }

      return reply.status(error.statusCode).send(errorResponse(error.code, error.message, error.details ?? null));
    }

    if (typeof error === 'object' && error !== null && 'validation' in error) {
      const message = error instanceof Error ? error.message : 'Validation failed';
      const validation = 'validation' in error && Array.isArray(error.validation) ? error.validation : [];

      request.log.info(
        {
          validationCount: validation.length,
        },
        'Request validation failed',
      );

      return reply.status(400).send(
        errorResponse(
          'VALIDATION_ERROR',
          message,
          validation.length > 0
            ? validation.map((issue) => ({
                instancePath: issue.instancePath,
                schemaPath: issue.schemaPath,
                keyword: issue.keyword,
                message: issue.message ?? 'Validation failed',
                params: issue.params,
              }))
            : null,
        ),
      );
    }

    request.log.error({ err: error }, 'Unhandled request error');

    const fallbackError = new AppError('Unexpected internal server error', 500, 'INTERNAL_ERROR');

    return reply.status(fallbackError.statusCode).send(
      errorResponse(fallbackError.code, fallbackError.message, null),
    );
  });

  fastify.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send(errorResponse('NOT_FOUND', 'Route not found', null));
  });
});
