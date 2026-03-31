import { Type } from '@sinclair/typebox';

import { createSuccessResponseSchema, isoDateTimeSchema, uuidSchema } from '../../utils/api-schemas';

const customFieldTypeSchema = Type.Union([
  Type.Literal('text'),
  Type.Literal('number'),
  Type.Literal('boolean'),
  Type.Literal('select'),
  Type.Literal('date'),
  Type.Literal('json'),
]);

export const customFieldDefinitionSchema = Type.Object(
  {
    id: uuidSchema,
    key: Type.String(),
    label: Type.String(),
    type: customFieldTypeSchema,
    optionsJson: Type.Any(),
    isRequired: Type.Boolean(),
    isFilterable: Type.Boolean(),
    isVisibleInList: Type.Boolean(),
    sortOrder: Type.Integer(),
    isActive: Type.Boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const customFieldListQuerySchema = Type.Object(
  {
    isActive: Type.Optional(
      Type.Boolean({
        description: 'Canonical active-state filter for frontend clients.',
      }),
    ),
    active: Type.Optional(
      Type.Boolean({
        description: 'Deprecated alias for `isActive` kept for backward compatibility.',
        deprecated: true,
      }),
    ),
  },
  { additionalProperties: false },
);

export const customFieldCreateBodySchema = Type.Object(
  {
    key: Type.String({ minLength: 2, maxLength: 100, pattern: '^[a-z][a-z0-9_]*$' }),
    label: Type.String({ minLength: 2, maxLength: 140 }),
    type: customFieldTypeSchema,
    optionsJson: Type.Optional(Type.Any()),
    isRequired: Type.Optional(Type.Boolean()),
    isFilterable: Type.Optional(Type.Boolean()),
    isVisibleInList: Type.Optional(Type.Boolean()),
    sortOrder: Type.Optional(Type.Integer()),
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const customFieldUpdateBodySchema = Type.Object(
  {
    label: Type.String({ minLength: 2, maxLength: 140 }),
    type: customFieldTypeSchema,
    optionsJson: Type.Optional(Type.Any()),
    isRequired: Type.Boolean(),
    isFilterable: Type.Boolean(),
    isVisibleInList: Type.Boolean(),
    sortOrder: Type.Integer(),
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

export const customFieldListResponseSchema = createSuccessResponseSchema(Type.Array(customFieldDefinitionSchema));

export const customFieldResponseSchema = createSuccessResponseSchema(customFieldDefinitionSchema);
