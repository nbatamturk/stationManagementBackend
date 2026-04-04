import { Type } from '@sinclair/typebox';

import { mobilePlatformValues } from '../../contracts/domain';
import {
  bearerAuthSecurity,
  createEnumSchema,
  createSuccessResponseSchema,
  isoDateTimeSchema,
  pickErrorResponseSchemas,
  uuidSchema,
} from '../../utils/api-schemas';

const versionPattern = '^\\d+\\.\\d+\\.\\d+$';

const versionStringSchema = Type.String({
  maxLength: 32,
  minLength: 5,
  pattern: versionPattern,
});

const nullableVersionStringSchema = Type.Union([versionStringSchema, Type.Null()]);
const nullableHttpsUrlSchema = Type.Union([Type.String({ maxLength: 2048 }), Type.Null()]);

const mobilePlatformSchema = createEnumSchema(mobilePlatformValues);

export const mobileAppConfigSchema = Type.Object(
  {
    iosMinimumSupportedVersion: nullableVersionStringSchema,
    androidMinimumSupportedVersion: nullableVersionStringSchema,
    iosDownloadUrl: nullableHttpsUrlSchema,
    androidDownloadUrl: nullableHttpsUrlSchema,
    updatedAt: Type.Union([isoDateTimeSchema, Type.Null()]),
    updatedByUserId: Type.Union([uuidSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

export const mobileAppConfigUpdateBodySchema = Type.Object(
  {
    iosMinimumSupportedVersion: nullableVersionStringSchema,
    androidMinimumSupportedVersion: nullableVersionStringSchema,
    iosDownloadUrl: nullableHttpsUrlSchema,
    androidDownloadUrl: nullableHttpsUrlSchema,
  },
  { additionalProperties: false },
);

export const mobileAppVersionCheckBodySchema = Type.Object(
  {
    platform: mobilePlatformSchema,
    appVersion: versionStringSchema,
  },
  { additionalProperties: false },
);

export const mobileAppVersionCheckResultSchema = Type.Object(
  {
    platform: mobilePlatformSchema,
    appVersion: versionStringSchema,
    minimumSupportedVersion: nullableVersionStringSchema,
    downloadUrl: nullableHttpsUrlSchema,
    shouldWarn: Type.Boolean(),
    warningMode: Type.Literal('warn'),
    message: Type.Union([Type.String({ minLength: 1, maxLength: 255 }), Type.Null()]),
  },
  { additionalProperties: false },
);

export const mobileAppConfigResponseSchema = createSuccessResponseSchema(mobileAppConfigSchema);
export const mobileAppVersionCheckResponseSchema = createSuccessResponseSchema(mobileAppVersionCheckResultSchema);

export const mobileAppConfigAdminRouteSecurity = bearerAuthSecurity;
export const mobileAppConfigAdminErrorSchemas = pickErrorResponseSchemas(400, 401, 403, 500);
