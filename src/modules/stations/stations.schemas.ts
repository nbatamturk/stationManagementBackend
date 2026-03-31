import { Type } from '@sinclair/typebox';

const stationStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('maintenance'),
  Type.Literal('inactive'),
  Type.Literal('faulty'),
  Type.Literal('archived'),
]);

const currentTypeSchema = Type.Union([Type.Literal('AC'), Type.Literal('DC')]);

const socketTypeSchema = Type.Union([
  Type.Literal('Type2'),
  Type.Literal('CCS2'),
  Type.Literal('CHAdeMO'),
  Type.Literal('GBT'),
  Type.Literal('NACS'),
  Type.Literal('Other'),
]);

export const stationListQuerySchema = Type.Object(
  {
    search: Type.Optional(Type.String({ minLength: 1 })),
    status: Type.Optional(stationStatusSchema),
    brand: Type.Optional(Type.String()),
    currentType: Type.Optional(currentTypeSchema),
    sortBy: Type.Optional(
      Type.Union([
        Type.Literal('name'),
        Type.Literal('createdAt'),
        Type.Literal('updatedAt'),
        Type.Literal('lastTestDate'),
        Type.Literal('powerKw'),
      ]),
    ),
    sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
    includeArchived: Type.Optional(Type.Boolean()),
    isArchived: Type.Optional(Type.Boolean()),
    createdFrom: Type.Optional(Type.String({ format: 'date-time' })),
    createdTo: Type.Optional(Type.String({ format: 'date-time' })),
    updatedFrom: Type.Optional(Type.String({ format: 'date-time' })),
    updatedTo: Type.Optional(Type.String({ format: 'date-time' })),
    powerMin: Type.Optional(Type.Number({ minimum: 0 })),
    powerMax: Type.Optional(Type.Number({ minimum: 0 })),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  {
    additionalProperties: true,
  },
);

export const stationIdParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const stationCreateBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 160 }),
    code: Type.String({ minLength: 2, maxLength: 80 }),
    qrCode: Type.String({ minLength: 2, maxLength: 150 }),
    brand: Type.String({ minLength: 1, maxLength: 120 }),
    model: Type.String({ minLength: 1, maxLength: 120 }),
    serialNumber: Type.String({ minLength: 2, maxLength: 150 }),
    powerKw: Type.Number({ minimum: 0 }),
    currentType: currentTypeSchema,
    socketType: socketTypeSchema,
    location: Type.String({ minLength: 2 }),
    status: Type.Optional(stationStatusSchema),
    lastTestDate: Type.Optional(Type.String({ format: 'date-time' })),
    notes: Type.Optional(Type.String()),
    customFields: Type.Optional(Type.Record(Type.String(), Type.Any())),
  },
  { additionalProperties: false },
);

export const stationUpdateBodySchema = Type.Partial(stationCreateBodySchema);

export const stationResponseDataSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  code: Type.String(),
  qrCode: Type.String(),
  brand: Type.String(),
  model: Type.String(),
  serialNumber: Type.String(),
  powerKw: Type.Number(),
  currentType: currentTypeSchema,
  socketType: socketTypeSchema,
  location: Type.String(),
  status: stationStatusSchema,
  lastTestDate: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  notes: Type.Union([Type.String(), Type.Null()]),
  isArchived: Type.Boolean(),
  archivedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  customFields: Type.Record(Type.String(), Type.Any()),
});

const paginationMetaSchema = Type.Object({
  page: Type.Integer({ minimum: 1 }),
  limit: Type.Integer({ minimum: 1 }),
  total: Type.Integer({ minimum: 0 }),
  totalPages: Type.Integer({ minimum: 0 }),
});

export const stationListResponseSchema = Type.Object({
  data: Type.Array(stationResponseDataSchema),
  meta: paginationMetaSchema,
});

export const stationResponseSchema = Type.Object({
  data: stationResponseDataSchema,
});

export const stationDeleteResponseSchema = Type.Object({
  success: Type.Boolean(),
  id: Type.String({ format: 'uuid' }),
});
