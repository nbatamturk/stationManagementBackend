import { Type } from '@sinclair/typebox';

import { stationTestResultValues } from '../../contracts/domain';
import {
  createCollectionResponseSchema,
  createEnumSchema,
  createSuccessResponseSchema,
  deleteResultDataSchema,
  isoDateTimeSchema,
  uuidSchema,
} from '../../utils/api-schemas';

export const testHistoryStationParamsSchema = Type.Object(
  {
    id: uuidSchema,
  },
  { additionalProperties: false },
);

export const testHistoryIdParamsSchema = Type.Object(
  {
    id: uuidSchema,
  },
  { additionalProperties: false },
);

const testResultSchema = createEnumSchema(stationTestResultValues);

const jsonObjectSchema = Type.Object({}, { additionalProperties: true });

export const testHistoryCreateBodySchema = Type.Object(
  {
    testDate: Type.Optional(isoDateTimeSchema),
    result: testResultSchema,
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
    metrics: Type.Optional(jsonObjectSchema),
  },
  { additionalProperties: false },
);

export const testHistoryUpdateBodySchema = Type.Object(
  {
    testDate: Type.Optional(isoDateTimeSchema),
    result: Type.Optional(testResultSchema),
    notes: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
    metrics: Type.Optional(jsonObjectSchema),
  },
  { additionalProperties: false, minProperties: 1 },
);

export const testHistoryRecordSchema = Type.Object(
  {
    id: uuidSchema,
    stationId: uuidSchema,
    testDate: isoDateTimeSchema,
    result: testResultSchema,
    notes: Type.Union([Type.String(), Type.Null()]),
    metrics: jsonObjectSchema,
    testedBy: Type.Union([uuidSchema, Type.Null()]),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const testHistoryListResponseSchema = createCollectionResponseSchema(testHistoryRecordSchema);

export const testHistoryResponseSchema = createSuccessResponseSchema(testHistoryRecordSchema);

export const testHistoryDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);
