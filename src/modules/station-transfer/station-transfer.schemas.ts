import { Type } from '@sinclair/typebox';

import { currentTypeValues, socketTypeValues, stationStatusValues } from '../../contracts/domain';
import { createEnumSchema, createSuccessResponseSchema, isoDateTimeSchema, uuidSchema } from '../../utils/api-schemas';

const stationStatusSchema = createEnumSchema(stationStatusValues);

const currentTypeSchema = createEnumSchema(currentTypeValues);

const socketTypeSchema = createEnumSchema(socketTypeValues);

const importIssueSchema = Type.Object(
  {
    severity: Type.Union([Type.Literal('error'), Type.Literal('warning')]),
    code: Type.String({ minLength: 1 }),
    message: Type.String({ minLength: 1 }),
    field: Type.Union([Type.String(), Type.Null()]),
    value: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    relatedRowNumbers: Type.Optional(Type.Array(Type.Integer({ minimum: 2 }))),
    existingStationId: Type.Optional(Type.Union([uuidSchema, Type.Null()])),
  },
  { additionalProperties: false },
);

const stationImportStationSchema = Type.Object(
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
    isArchived: Type.Optional(Type.Boolean()),
    lastTestDate: Type.Optional(isoDateTimeSchema),
    notes: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

const stationImportCandidateSchema = Type.Object(
  {
    rowNumber: Type.Integer({ minimum: 2 }),
    station: stationImportStationSchema,
    customFields: Type.Optional(Type.Record(Type.String(), Type.Any())),
  },
  { additionalProperties: false },
);

const stationImportPreviewDataSchema = Type.Object(
  {
    fileName: Type.Union([Type.String(), Type.Null()]),
    headers: Type.Array(Type.String()),
    rules: Type.Object(
      {
        mode: Type.Literal('upsert'),
        matchKey: Type.Literal('code'),
        requiredColumns: Type.Array(Type.String()),
        optionalColumns: Type.Array(Type.String()),
        readonlyColumns: Type.Array(Type.String()),
        customFieldPrefix: Type.String(),
      },
      { additionalProperties: false },
    ),
    columns: Type.Object(
      {
        unknownColumns: Type.Array(Type.String()),
        unknownCustomFields: Type.Array(Type.String()),
        missingRequiredColumns: Type.Array(Type.String()),
        missingRequiredCustomFieldColumns: Type.Array(Type.String()),
      },
      { additionalProperties: false },
    ),
    summary: Type.Object(
      {
        totalRows: Type.Integer({ minimum: 0 }),
        validRows: Type.Integer({ minimum: 0 }),
        invalidRows: Type.Integer({ minimum: 0 }),
        createCandidates: Type.Integer({ minimum: 0 }),
        updateCandidates: Type.Integer({ minimum: 0 }),
        skipCandidates: Type.Integer({ minimum: 0 }),
      },
      { additionalProperties: false },
    ),
    rows: Type.Array(
      Type.Object(
        {
          rowNumber: Type.Integer({ minimum: 2 }),
          status: Type.Union([Type.Literal('valid'), Type.Literal('invalid')]),
          action: Type.Union([Type.Literal('create'), Type.Literal('update'), Type.Literal('skip')]),
          canApply: Type.Boolean(),
          existingStationId: Type.Union([uuidSchema, Type.Null()]),
          raw: Type.Record(Type.String(), Type.String()),
          issues: Type.Array(importIssueSchema),
          candidate: Type.Union([stationImportCandidateSchema, Type.Null()]),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const stationImportPreviewResponseSchema = createSuccessResponseSchema(stationImportPreviewDataSchema);

export const stationImportApplyBodySchema = Type.Object(
  {
    mode: Type.Optional(Type.Literal('upsert')),
    rows: Type.Array(stationImportCandidateSchema, { minItems: 1 }),
  },
  { additionalProperties: false },
);

const stationImportApplyDataSchema = Type.Object(
  {
    mode: Type.Literal('upsert'),
    totalRows: Type.Integer({ minimum: 0 }),
    createdCount: Type.Integer({ minimum: 0 }),
    updatedCount: Type.Integer({ minimum: 0 }),
    skippedCount: Type.Integer({ minimum: 0 }),
    failedRows: Type.Array(
      Type.Object(
        {
          rowNumber: Type.Integer({ minimum: 2 }),
          code: Type.Union([Type.String(), Type.Null()]),
          message: Type.String(),
          issues: Type.Array(importIssueSchema),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const stationImportApplyResponseSchema = createSuccessResponseSchema(stationImportApplyDataSchema);
