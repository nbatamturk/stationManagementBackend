import helmet from '@fastify/helmet';
import fp from 'fastify-plugin';

import { env } from '../config/env';
import { type SecurityEventInput, writeSecurityEvent } from '../utils/security-events';

declare module 'fastify' {
  interface FastifyInstance {
    auditSecurityEvent: (input: SecurityEventInput) => Promise<void>;
  }
}

export const securityPlugin = fp(async (fastify) => {
  await fastify.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: false,
    global: true,
    strictTransportSecurity: env.NODE_ENV === 'production' ? undefined : false,
  });

  fastify.decorate('auditSecurityEvent', async (input: SecurityEventInput) => {
    try {
      await writeSecurityEvent(input);
    } catch (error) {
      fastify.log.warn(
        {
          action: input.action,
          err: error,
        },
        'Failed to persist security audit event',
      );
    }
  });
});
