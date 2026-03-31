import { Type } from '@sinclair/typebox';

import { createSuccessResponseSchema, uuidSchema } from '../../utils/api-schemas';

export const loginBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 255 }),
    password: Type.String({ minLength: 6, maxLength: 128 }),
  },
  { additionalProperties: false },
);

export const authUserSchema = Type.Object(
  {
    id: uuidSchema,
    email: Type.String({ format: 'email' }),
    fullName: Type.String(),
    role: Type.Union([Type.Literal('admin'), Type.Literal('operator'), Type.Literal('viewer')]),
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

export const loginResponseSchema = createSuccessResponseSchema(loginResponseDataSchema);

export const meResponseSchema = createSuccessResponseSchema(meResponseDataSchema);
