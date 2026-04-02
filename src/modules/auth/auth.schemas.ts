import { Type } from '@sinclair/typebox';

import { userRoleValues } from '../../contracts/domain';
import { createEnumSchema, createSuccessResponseSchema, uuidSchema } from '../../utils/api-schemas';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../utils/password';

export const loginBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 255 }),
    password: Type.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
  },
  { additionalProperties: false },
);

export const changePasswordBodySchema = Type.Object(
  {
    currentPassword: Type.String({ minLength: 1, maxLength: PASSWORD_MAX_LENGTH }),
    newPassword: Type.String({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH }),
  },
  { additionalProperties: false },
);

export const authUserSchema = Type.Object(
  {
    id: uuidSchema,
    email: Type.String({ format: 'email' }),
    fullName: Type.String(),
    role: createEnumSchema(userRoleValues),
    isActive: Type.Boolean(),
  },
  { additionalProperties: false },
);

const loginResponseDataSchema = Type.Object(
  {
    accessToken: Type.String({
      minLength: 1,
      description: 'JWT access token to send as `Authorization: Bearer <accessToken>`.',
    }),
    tokenType: Type.Literal('Bearer', {
      description: 'Bearer token type. Always `Bearer`.',
    }),
    expiresIn: Type.String({
      minLength: 1,
      description: 'Token lifetime string returned by the server, such as `1d`.',
    }),
    session: Type.Object(
      {
        strategy: Type.Literal('jwt-bearer'),
        sessionVersion: Type.Literal(1),
        accessTokenExpiresIn: Type.String({ minLength: 1 }),
        refreshTokenEnabled: Type.Boolean(),
        refreshEndpoint: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
      },
      { additionalProperties: false },
    ),
    user: authUserSchema,
  },
  { additionalProperties: false },
);

const meResponseDataSchema = Type.Object(
  {
    user: authUserSchema,
  },
  { additionalProperties: false },
);

const changePasswordResponseDataSchema = Type.Object(
  {
    success: Type.Literal(true),
  },
  { additionalProperties: false },
);

export const loginResponseSchema = createSuccessResponseSchema(loginResponseDataSchema);

export const meResponseSchema = createSuccessResponseSchema(meResponseDataSchema);

export const changePasswordResponseSchema = createSuccessResponseSchema(changePasswordResponseDataSchema);
