import { Type } from '@sinclair/typebox';

import { customFieldTypeValues } from '../../contracts/domain';
import {
  createCollectionResponseSchema,
  createEnumSchema,
  createSuccessResponseSchema,
  deleteResultDataSchema,
  isoDateTimeSchema,
  uuidSchema,
} from '../../utils/api-schemas';

const customFieldTypeSchema = createEnumSchema(customFieldTypeValues);

const jsonObjectSchema = Type.Object({}, { additionalProperties: true });

export const customFieldDefinitionSchema = Type.Object(
  {
    id: uuidSchema,
    key: Type.String(),
    label: Type.String(),
    type: customFieldTypeSchema,
    options: jsonObjectSchema,
    isRequired: Type.Boolean(),
    isFilterable: Type.Boolean(),
    isVisibleInList: Type.Boolean(),
    sortOrder: Type.Integer({ minimum: 0, maximum: 10_000 }),
    isActive: Type.Boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const customFieldListQuerySchema = Type.Object(
  {
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const customFieldCreateBodySchema = Type.Object(
  {
    key: Type.String({ minLength: 2, maxLength: 100, pattern: '^[a-z][a-z0-9_]*$' }),
    label: Type.String({ minLength: 2, maxLength: 140 }),
    type: customFieldTypeSchema,
    options: Type.Optional(jsonObjectSchema),
    isRequired: Type.Optional(Type.Boolean()),
    isFilterable: Type.Optional(Type.Boolean()),
    isVisibleInList: Type.Optional(Type.Boolean()),
    sortOrder: Type.Optional(Type.Integer({ minimum: 0, maximum: 10_000 })),
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const customFieldUpdateBodySchema = Type.Object(
  {
    label: Type.String({ minLength: 2, maxLength: 140 }),
    type: customFieldTypeSchema,
    options: Type.Optional(jsonObjectSchema),
    isRequired: Type.Boolean(),
    isFilterable: Type.Boolean(),
    isVisibleInList: Type.Boolean(),
    sortOrder: Type.Integer({ minimum: 0, maximum: 10_000 }),
  },
  { additionalProperties: false },
);

export const customFieldSetActiveBodySchema = Type.Object(
  {
    isActive: Type.Boolean(),
  },
  { additionalProperties: false },
);

export const customFieldIdParamsSchema = Type.Object(
  {
    id: uuidSchema,
  },
  { additionalProperties: false },
);

export const customFieldListResponseSchema = createCollectionResponseSchema(customFieldDefinitionSchema);

export const customFieldResponseSchema = createSuccessResponseSchema(customFieldDefinitionSchema);

export const customFieldDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);
