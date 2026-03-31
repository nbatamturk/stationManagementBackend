import { Type } from '@sinclair/typebox';

import {
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

const testResultSchema = Type.Union([Type.Literal('pass'), Type.Literal('fail'), Type.Literal('warning')]);

export const testHistoryCreateBodySchema = Type.Object(
  {
    testDate: Type.Optional(isoDateTimeSchema),
    result: testResultSchema,
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
    metricsJson: Type.Optional(Type.Any()),
  },
  { additionalProperties: false },
);

export const testHistoryUpdateBodySchema = Type.Object(
  {
    testDate: Type.Optional(isoDateTimeSchema),
    result: Type.Optional(testResultSchema),
    notes: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
    metricsJson: Type.Optional(Type.Any()),
  },
  { additionalProperties: false },
);

export const testHistoryRecordSchema = Type.Object(
  {
    id: uuidSchema,
    stationId: uuidSchema,
    testDate: isoDateTimeSchema,
    result: testResultSchema,
    notes: Type.Union([Type.String(), Type.Null()]),
    metricsJson: Type.Any(),
    testedBy: Type.Union([uuidSchema, Type.Null()]),
    createdAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const testHistoryListResponseSchema = createSuccessResponseSchema(Type.Array(testHistoryRecordSchema));

export const testHistoryResponseSchema = createSuccessResponseSchema(testHistoryRecordSchema);

export const testHistoryDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);
