import type { FastifyRequest } from 'fastify';

import { AppError } from './errors';

export const getCurrentUserId = (request: FastifyRequest): string => {
  const userId = request.user?.sub;

  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  return userId;
};
