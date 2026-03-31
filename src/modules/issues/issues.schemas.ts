import { Type } from '@sinclair/typebox';

import {
  createSuccessResponseSchema,
  deleteResultDataSchema,
  isoDateTimeSchema,
  uuidSchema,
} from '../../utils/api-schemas';

export const issueStationParamsSchema = Type.Object(
  {
    id: uuidSchema,
  },
  { additionalProperties: false },
);

export const issueIdParamsSchema = Type.Object(
  {
    id: uuidSchema,
  },
  { additionalProperties: false },
);

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
    description: Type.Optional(Type.String({ maxLength: 4000 })),
    severity: Type.Optional(issueSeveritySchema),
    assignedTo: Type.Optional(uuidSchema),
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
    description: Type.Optional(Type.Union([Type.String({ maxLength: 4000 }), Type.Null()])),
    severity: Type.Optional(issueSeveritySchema),
    status: Type.Optional(issueStatusSchema),
    assignedTo: Type.Optional(Type.Union([uuidSchema, Type.Null()])),
  },
  { additionalProperties: false },
);

export const issueRecordSchema = Type.Object(
  {
    id: uuidSchema,
    stationId: uuidSchema,
    title: Type.String(),
    description: Type.Union([Type.String(), Type.Null()]),
    severity: issueSeveritySchema,
    status: issueStatusSchema,
    reportedBy: Type.Union([uuidSchema, Type.Null()]),
    assignedTo: Type.Union([uuidSchema, Type.Null()]),
    resolvedAt: Type.Union([isoDateTimeSchema, Type.Null()]),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const issueListResponseSchema = createSuccessResponseSchema(Type.Array(issueRecordSchema));

export const issueResponseSchema = createSuccessResponseSchema(issueRecordSchema);

export const issueDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);
