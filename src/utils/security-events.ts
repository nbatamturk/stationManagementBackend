import { createHash } from 'node:crypto';

import type { FastifyRequest } from 'fastify';

import { writeAuditLog } from './audit-log';

export const SECURITY_AUDIT_ENTITY_ID = '00000000-0000-0000-0000-000000000000';

export type SecurityEventInput = {
  action: string;
  actorUserId?: string;
  entityId?: string;
  entityType?: string;
  metadataJson?: Record<string, unknown>;
};

const truncate = (value: string, maxLength: number) => value.slice(0, maxLength);

export const fingerprintValue = (value: string) =>
  createHash('sha256').update(value).digest('hex').slice(0, 16);

export const maskEmail = (value: string) => {
  const [localPart, domain] = value.split('@');

  if (!localPart || !domain) {
    return 'unknown';
  }

  const visibleLocalPart = localPart.length <= 2 ? localPart[0] ?? '*' : `${localPart[0]}${'*'.repeat(Math.min(4, localPart.length - 2))}${localPart.at(-1)}`;
  return `${visibleLocalPart}@${domain}`;
};

export const getRequestSecurityMetadata = (request: FastifyRequest) => ({
  requestId: request.id,
  method: request.method,
  route: request.routeOptions.url,
  url: request.url,
  ip: request.ip,
  userAgent:
    typeof request.headers['user-agent'] === 'string'
      ? truncate(request.headers['user-agent'], 255)
      : null,
});

export const writeSecurityEvent = async (
  input: SecurityEventInput,
  executor?: Parameters<typeof writeAuditLog>[1],
) => {
  await writeAuditLog(
    {
      actorUserId: input.actorUserId,
      entityType: input.entityType ?? 'security',
      entityId: input.entityId ?? SECURITY_AUDIT_ENTITY_ID,
      action: input.action,
      metadataJson: {
        category: 'security',
        ...input.metadataJson,
      },
    },
    executor,
  );
};
