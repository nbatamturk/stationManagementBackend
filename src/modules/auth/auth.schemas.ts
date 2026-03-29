import { Type } from '@sinclair/typebox';

export const loginBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email' }),
    password: Type.String({ minLength: 6 }),
  },
  { additionalProperties: false },
);

export const authUserSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  fullName: Type.String(),
  role: Type.Union([Type.Literal('admin'), Type.Literal('operator'), Type.Literal('viewer')]),
  isActive: Type.Boolean(),
});

export const loginResponseSchema = Type.Object({
  accessToken: Type.String(),
  tokenType: Type.Literal('Bearer'),
  expiresIn: Type.String(),
  user: authUserSchema,
});

export const meResponseSchema = Type.Object({
  user: authUserSchema,
});
