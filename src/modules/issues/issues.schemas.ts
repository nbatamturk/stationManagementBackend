import { Type } from '@sinclair/typebox';

import { issueSeverityValues, issueStatusValues } from '../../contracts/domain';
import {
  createCollectionResponseSchema,
  createEnumSchema,
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

const issueSeveritySchema = createEnumSchema(issueSeverityValues);

const issueStatusSchema = createEnumSchema(issueStatusValues);

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
  { additionalProperties: false, minProperties: 1 },
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

export const issueListResponseSchema = createCollectionResponseSchema(issueRecordSchema);

export const issueResponseSchema = createSuccessResponseSchema(issueRecordSchema);

export const issueDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);
