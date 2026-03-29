import { Type } from '@sinclair/typebox';

const customFieldTypeSchema = Type.Union([
  Type.Literal('text'),
  Type.Literal('number'),
  Type.Literal('boolean'),
  Type.Literal('select'),
  Type.Literal('date'),
  Type.Literal('json'),
]);

export const customFieldDefinitionSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  key: Type.String(),
  label: Type.String(),
  type: customFieldTypeSchema,
  optionsJson: Type.Any(),
  isRequired: Type.Boolean(),
  isFilterable: Type.Boolean(),
  isVisibleInList: Type.Boolean(),
  sortOrder: Type.Integer(),
  isActive: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export const customFieldListQuerySchema = Type.Object({
  active: Type.Optional(Type.Boolean()),
});

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

export const customFieldIdParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const customFieldListResponseSchema = Type.Object({
  data: Type.Array(customFieldDefinitionSchema),
});

export const customFieldResponseSchema = Type.Object({
  data: customFieldDefinitionSchema,
});
