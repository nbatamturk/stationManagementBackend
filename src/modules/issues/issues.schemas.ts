import { Type } from '@sinclair/typebox';

export const issueStationParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const issueIdParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

const issueSeveritySchema = Type.Union([
  Type.Literal('low'),
  Type.Literal('medium'),
  Type.Literal('high'),
  Type.Literal('critical'),
]);

const issueStatusSchema = Type.Union([
  Type.Literal('open'),
  Type.Literal('in_progress'),
  Type.Literal('resolved'),
  Type.Literal('closed'),
]);

export const issueCreateBodySchema = Type.Object(
  {
    title: Type.String({ minLength: 3, maxLength: 160 }),
    description: Type.Optional(Type.String()),
    severity: Type.Optional(issueSeveritySchema),
    assignedTo: Type.Optional(Type.String({ format: 'uuid' })),
  },
  { additionalProperties: false },
);

export const issueStatusPatchBodySchema = Type.Object(
  {
    status: issueStatusSchema,
  },
  { additionalProperties: false },
);

export const issueUpdateBodySchema = Type.Object(
  {
    title: Type.Optional(Type.String({ minLength: 3, maxLength: 160 })),
    description: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    severity: Type.Optional(issueSeveritySchema),
    status: Type.Optional(issueStatusSchema),
    assignedTo: Type.Optional(Type.Union([Type.String({ format: 'uuid' }), Type.Null()])),
  },
  { additionalProperties: false },
);

export const issueRecordSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  stationId: Type.String({ format: 'uuid' }),
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  severity: issueSeveritySchema,
  status: issueStatusSchema,
  reportedBy: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  assignedTo: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  resolvedAt: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export const issueListResponseSchema = Type.Object({
  data: Type.Array(issueRecordSchema),
});

export const issueResponseSchema = Type.Object({
  data: issueRecordSchema,
});

export const issueDeleteResponseSchema = Type.Object({
  success: Type.Boolean(),
  id: Type.String({ format: 'uuid' }),
});
