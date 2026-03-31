import { Type } from '@sinclair/typebox';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import Fastify from 'fastify';

import { env } from './config/env';
import { pool } from './db/client';
import { authRoutes } from './modules/auth/auth.routes';
import { attachmentsRoutes } from './modules/attachments/attachments.routes';
import { auditLogsRoutes } from './modules/audit-logs/audit-logs.routes';
import { customFieldsRoutes } from './modules/custom-fields/custom-fields.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { issuesRoutes } from './modules/issues/issues.routes';
import { stationsRoutes } from './modules/stations/stations.routes';
import { stationTransferRoutes } from './modules/station-transfer/station-transfer.routes';
import { testHistoryRoutes } from './modules/test-history/test-history.routes';
import { usersRoutes } from './modules/users/users.routes';
import { authPlugin } from './plugins/auth';
import { errorHandlerPlugin } from './plugins/error-handler';
import { securityPlugin } from './plugins/security';
import { swaggerPlugin } from './plugins/swagger';
import { isoDateTimeSchema } from './utils/api-schemas';

export const buildApp = () => {
  const app = Fastify({
    bodyLimit: env.JSON_BODY_LIMIT_BYTES,
    logger: {
      level: env.LOG_LEVEL,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.password',
          'req.body.currentPassword',
          'req.body.newPassword',
          'req.body.accessToken',
          'req.body.refreshToken',
          'req.body.token',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
    },
    trustProxy: env.TRUST_PROXY,
  });

  app.register(cors, {
    origin: true,
    strictPreflight: true,
  });

  app.register(swaggerPlugin);
  app.register(errorHandlerPlugin);
  app.register(securityPlugin);
  app.register(authPlugin);
  app.register(multipart, {
    limits: {
      files: 1,
      fileSize: env.ATTACHMENTS_MAX_FILE_SIZE_BYTES,
    },
  });

  app.get(
    '/health',
    {
      schema: {
        tags: ['System'],
        summary: 'Health check',
        description: 'Operational health endpoint used to verify the API process is running.',
        response: {
          200: Type.Object(
            {
              status: Type.Literal('ok'),
              timestamp: isoDateTimeSchema,
            },
            { additionalProperties: false },
          ),
        },
      },
    },
    async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
      };
    },
  );

  app.register(authRoutes, { prefix: '/auth' });
  app.register(stationsRoutes, { prefix: '/stations' });
  app.register(stationTransferRoutes);
  app.register(customFieldsRoutes, { prefix: '/custom-fields' });
  app.register(testHistoryRoutes);
  app.register(issuesRoutes);
  app.register(attachmentsRoutes);
  app.register(usersRoutes, { prefix: '/users' });
  app.register(auditLogsRoutes);
  app.register(dashboardRoutes);

  app.addHook('onClose', async () => {
    await pool.end();
  });

  return app;
};
