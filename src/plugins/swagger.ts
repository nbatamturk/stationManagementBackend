import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

const firstHeaderValue = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

const buildServerUrl = (request: FastifyRequest) => {
  const host =
    firstHeaderValue(request.headers['x-forwarded-host']) ??
    firstHeaderValue(request.headers.host) ??
    'localhost:3000';
  const protocol = firstHeaderValue(request.headers['x-forwarded-proto']) ?? 'http';

  return `${protocol}://${host}`;
};

export const swaggerPlugin = fp(async (fastify) => {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: {
        title: 'Station Management Backend API',
        version: '1.0.0',
        description:
          'API documentation for the station management backend. Successful JSON responses use either `{ data }` or `{ data, meta }`. Date-time fields are serialized as ISO 8601 UTC strings. Protected routes require `Authorization: Bearer <accessToken>` using the token returned by `POST /auth/login`.',
      },
      tags: [
        { name: 'System', description: 'Operational endpoints.' },
        { name: 'Auth', description: 'Authentication and current-user endpoints.' },
        { name: 'Stations', description: 'Station CRUD, filtering, and archival.' },
        { name: 'Station Transfer', description: 'CSV station export and import endpoints.' },
        { name: 'Custom Fields', description: 'Dynamic station custom field definitions.' },
        { name: 'Test History', description: 'Station test history records.' },
        { name: 'Issues', description: 'Station issue tracking endpoints.' },
        { name: 'Attachments', description: 'Attachment upload, list, delete, and download endpoints.' },
        { name: 'Users', description: 'Admin-only user management.' },
        { name: 'Audit Logs', description: 'Admin-only audit log access.' },
        { name: 'Dashboard', description: 'Admin dashboard summary and recent activity.' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'Send the access token from `POST /auth/login` as `Authorization: Bearer <accessToken>`. The `expiresIn` value in the login response is the source of truth for token lifetime.',
          },
        },
      },
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
    },
    staticCSP: true,
    transformSpecificationClone: true,
    transformSpecification: (swaggerObject, request) => ({
      ...swaggerObject,
      servers: [
        {
          url: buildServerUrl(request),
          description: 'Current server',
        },
      ],
    }),
  });
});
