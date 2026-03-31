import { Type } from '@sinclair/typebox';

export const auditLogsListQuerySchema = Type.Object(
  {
    entityType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    entityId: Type.Optional(Type.String({ format: 'uuid' })),
    actorUserId: Type.Optional(Type.String({ format: 'uuid' })),
    action: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    fromDate: Type.Optional(Type.String({ format: 'date-time' })),
    toDate: Type.Optional(Type.String({ format: 'date-time' })),
    sortBy: Type.Optional(Type.Union([Type.Literal('createdAt')])),
    sortOrder: Type.Optional(Type.Union([Type.Literal('desc'), Type.Literal('asc')])),
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

const paginationMetaSchema = Type.Object({
  page: Type.Integer({ minimum: 1 }),
  limit: Type.Integer({ minimum: 1 }),
  total: Type.Integer({ minimum: 0 }),
  totalPages: Type.Integer({ minimum: 0 }),
});

const auditLogSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  actorUserId: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  entityType: Type.String(),
  entityId: Type.String({ format: 'uuid' }),
  action: Type.String(),
  metadataJson: Type.Record(Type.String(), Type.Any()),
  createdAt: Type.String({ format: 'date-time' }),
});

export const auditLogsListResponseSchema = Type.Object({
  data: Type.Array(auditLogSchema),
  meta: paginationMetaSchema,
});
