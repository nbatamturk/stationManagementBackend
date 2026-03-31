import { Type } from '@sinclair/typebox';

import { createPaginatedResponseSchema, isoDateTimeSchema, uuidSchema } from '../../utils/api-schemas';

export const auditLogsListQuerySchema = Type.Object(
  {
    entityType: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
    entityId: Type.Optional(uuidSchema),
    actorUserId: Type.Optional(uuidSchema),
    action: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    fromDate: Type.Optional(isoDateTimeSchema),
    toDate: Type.Optional(isoDateTimeSchema),
    sortBy: Type.Optional(Type.Union([Type.Literal('createdAt')])),
    sortOrder: Type.Optional(Type.Union([Type.Literal('desc'), Type.Literal('asc')])),
    page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
  },
  { additionalProperties: false },
);

const auditLogSchema = Type.Object(
  {
    id: uuidSchema,
    actorUserId: Type.Union([uuidSchema, Type.Null()]),
    entityType: Type.String(),
    entityId: uuidSchema,
    action: Type.String(),
    metadataJson: Type.Record(Type.String(), Type.Any()),
    createdAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const auditLogsListResponseSchema = createPaginatedResponseSchema(auditLogSchema);
