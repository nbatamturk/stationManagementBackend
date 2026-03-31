import type { FastifyRequest } from 'fastify';

import type { UserRole } from '../db/schema';
import { AppError } from './errors';

export const getCurrentUserRole = (request: FastifyRequest): UserRole => {
  const role = request.user?.role;

  if (!role) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  return role;
};

export const requireRoles = (allowedRoles: UserRole[]) => {
  return async (request: FastifyRequest) => {
    const role = getCurrentUserRole(request);

    if (!allowedRoles.includes(role)) {
      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
  };
};

export const assertCanWrite = (request: FastifyRequest) => {
  const role = getCurrentUserRole(request);

  if (role === 'viewer') {
    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
};
