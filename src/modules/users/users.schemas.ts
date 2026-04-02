import { Type } from '@sinclair/typebox';

import { userRoleValues } from '../../contracts/domain';
import {
  createPaginatedResponseSchema,
  createEnumSchema,
  createSuccessResponseSchema,
  isoDateTimeSchema,
  uuidSchema,
} from '../../utils/api-schemas';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../../utils/password';

const userRoleSchema = createEnumSchema(userRoleValues);

export const userIdParamsSchema = Type.Object(
  {
    id: uuidSchema,
  },
  { additionalProperties: false },
);

export const usersListQuerySchema = Type.Object(
  {
    page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    role: Type.Optional(userRoleSchema),
    isActive: Type.Optional(Type.Boolean()),
    search: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
  },
  { additionalProperties: false },
);

export const userCreateBodySchema = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 255 }),
    fullName: Type.String({ minLength: 2, maxLength: 150 }),
    password: Type.String({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH }),
    role: Type.Optional(userRoleSchema),
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const userUpdateBodySchema = Type.Object(
  {
    email: Type.Optional(Type.String({ format: 'email', maxLength: 255 })),
    fullName: Type.Optional(Type.String({ minLength: 2, maxLength: 150 })),
    password: Type.Optional(Type.String({ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH })),
    role: Type.Optional(userRoleSchema),
  },
  { additionalProperties: false, minProperties: 1 },
);

export const userActivePatchBodySchema = Type.Object(
  {
    isActive: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const safeUserSchema = Type.Object(
  {
    id: uuidSchema,
    email: Type.String({ format: 'email' }),
    fullName: Type.String(),
    role: userRoleSchema,
    isActive: Type.Boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const usersListResponseSchema = createPaginatedResponseSchema(safeUserSchema);

export const userResponseSchema = createSuccessResponseSchema(safeUserSchema);
