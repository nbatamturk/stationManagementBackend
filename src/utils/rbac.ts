import type { FastifyRequest } from 'fastify';

import type { UserRole } from '../db/schema';
import { AppError } from './errors';
import { getRequestSecurityMetadata } from './security-events';

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
      request.log.warn(
        {
          ...getRequestSecurityMetadata(request),
          actualRole: role,
          event: 'authorization.forbidden',
          requiredRoles: allowedRoles,
        },
        'Forbidden route access attempt',
      );

      await request.server.auditSecurityEvent({
        action: 'authorization.forbidden',
        actorUserId: request.user?.sub,
        metadataJson: {
          ...getRequestSecurityMetadata(request),
          actualRole: role,
          requiredRoles: allowedRoles,
        },
      });

      throw new AppError('Forbidden', 403, 'FORBIDDEN');
    }
  };
};

export const assertCanWrite = async (request: FastifyRequest) => {
  const role = getCurrentUserRole(request);

  if (role === 'viewer') {
    request.log.warn(
      {
        ...getRequestSecurityMetadata(request),
        actualRole: role,
        event: 'authorization.write_forbidden',
      },
      'Viewer write attempt rejected',
    );

    await request.server.auditSecurityEvent({
      action: 'authorization.write_forbidden',
      actorUserId: request.user?.sub,
      metadataJson: {
        ...getRequestSecurityMetadata(request),
        actualRole: role,
      },
    });

    throw new AppError('Forbidden', 403, 'FORBIDDEN');
  }
};
