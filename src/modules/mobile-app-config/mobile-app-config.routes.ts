import type { FastifyPluginAsync } from 'fastify';

import { mobilePlatformValues } from '../../contracts/domain';
import { successResponse } from '../../utils/api-response';
import { getCurrentUserId } from '../../utils/auth';
import { pickErrorResponseSchemas } from '../../utils/api-schemas';
import { requireRoles } from '../../utils/rbac';
import { strictWriteRouteOptions } from '../../utils/strict-validator';

import {
  mobileAppConfigAdminErrorSchemas,
  mobileAppConfigAdminRouteSecurity,
  mobileAppConfigResponseSchema,
  mobileAppConfigUpdateBodySchema,
  mobileAppVersionCheckBodySchema,
  mobileAppVersionCheckResponseSchema,
} from './mobile-app-config.schemas';
import { mobileAppConfigService } from './mobile-app-config.service';

export const mobileAppConfigRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/',
    {
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Mobile App Config'],
        summary: 'Get mobile app version policy',
        description:
          'Returns the singleton minimum supported mobile app versions and optional platform download URLs used by admin-web and mobile app launch checks.',
        security: mobileAppConfigAdminRouteSecurity,
        response: {
          200: mobileAppConfigResponseSchema,
          ...mobileAppConfigAdminErrorSchemas,
        },
      },
    },
    async () => successResponse(await mobileAppConfigService.get()),
  );

  fastify.put(
    '/',
    {
      ...strictWriteRouteOptions,
      preHandler: [fastify.authenticate, requireRoles(['admin'])],
      schema: {
        tags: ['Mobile App Config'],
        summary: 'Update mobile app version policy',
        description:
          'Updates the minimum supported mobile app version and optional download URL per platform for future app launch warnings.',
        security: mobileAppConfigAdminRouteSecurity,
        body: mobileAppConfigUpdateBodySchema,
        response: {
          200: mobileAppConfigResponseSchema,
          ...mobileAppConfigAdminErrorSchemas,
        },
      },
    },
    async (request) => {
      const body = request.body as {
        iosMinimumSupportedVersion: string | null;
        androidMinimumSupportedVersion: string | null;
        iosDownloadUrl: string | null;
        androidDownloadUrl: string | null;
      };

      return successResponse(await mobileAppConfigService.update(getCurrentUserId(request), body));
    },
  );

  fastify.post(
    '/check',
    {
      ...strictWriteRouteOptions,
      schema: {
        tags: ['Mobile App Config'],
        summary: 'Check whether a mobile app version should trigger a warning',
        description:
          'Public endpoint intended for future mobile app launch checks. Returns warning guidance when the installed version is below the configured minimum for the platform.',
        body: mobileAppVersionCheckBodySchema,
        response: {
          200: mobileAppVersionCheckResponseSchema,
          ...pickErrorResponseSchemas(400, 500),
        },
      },
    },
    async (request) => {
      const body = request.body as {
        platform: (typeof mobilePlatformValues)[number];
        appVersion: string;
      };

      return successResponse(await mobileAppConfigService.check(body));
    },
  );
};
