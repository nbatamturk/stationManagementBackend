import cors from '@fastify/cors';
import Fastify from 'fastify';

import { env } from './config/env';
import { pool } from './db/client';
import { authRoutes } from './modules/auth/auth.routes';
import { auditLogsRoutes } from './modules/audit-logs/audit-logs.routes';
import { customFieldsRoutes } from './modules/custom-fields/custom-fields.routes';
import { dashboardRoutes } from './modules/dashboard/dashboard.routes';
import { issuesRoutes } from './modules/issues/issues.routes';
import { stationsRoutes } from './modules/stations/stations.routes';
import { testHistoryRoutes } from './modules/test-history/test-history.routes';
import { usersRoutes } from './modules/users/users.routes';
import { authPlugin } from './plugins/auth';
import { errorHandlerPlugin } from './plugins/error-handler';

export const buildApp = () => {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  app.register(cors, {
    origin: true,
  });

  app.register(errorHandlerPlugin);
  app.register(authPlugin);

  app.get('/health', async () => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  });

  app.register(authRoutes, { prefix: '/auth' });
  app.register(stationsRoutes, { prefix: '/stations' });
  app.register(customFieldsRoutes, { prefix: '/custom-fields' });
  app.register(testHistoryRoutes);
  app.register(issuesRoutes);
  app.register(usersRoutes, { prefix: '/users' });
  app.register(auditLogsRoutes);
  app.register(dashboardRoutes);

  app.addHook('onClose', async () => {
    await pool.end();
  });

  return app;
};
