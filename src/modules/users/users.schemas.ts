import { Type } from '@sinclair/typebox';

const userRoleSchema = Type.Union([Type.Literal('admin'), Type.Literal('operator'), Type.Literal('viewer')]);

export const userIdParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const usersListQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    role: Type.Optional(userRoleSchema),
    isActive: Type.Optional(Type.Boolean()),
    search: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);

export const userCreateBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 255 }),
    fullName: Type.String({ minLength: 2, maxLength: 150 }),
    password: Type.String({ minLength: 8, maxLength: 128 }),
    role: Type.Optional(userRoleSchema),
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const userUpdateBodySchema = Type.Object(
  {
    email: Type.Optional(Type.String({ format: 'email', maxLength: 255 })),
    fullName: Type.Optional(Type.String({ minLength: 2, maxLength: 150 })),
    password: Type.Optional(Type.String({ minLength: 8, maxLength: 128 })),
    role: Type.Optional(userRoleSchema),
  },
  { additionalProperties: false },
);

export const userActivePatchBodySchema = Type.Object(
  {
    isActive: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const safeUserSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
  fullName: Type.String(),
  role: userRoleSchema,
  isActive: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

const paginationMetaSchema = Type.Object({
  page: Type.Integer({ minimum: 1 }),
  limit: Type.Integer({ minimum: 1 }),
  total: Type.Integer({ minimum: 0 }),
  totalPages: Type.Integer({ minimum: 0 }),
});

export const usersListResponseSchema = Type.Object({
  data: Type.Array(safeUserSchema),
  meta: paginationMetaSchema,
});

export const userResponseSchema = Type.Object({
  data: safeUserSchema,
});
