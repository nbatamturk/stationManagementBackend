import { Type } from '@sinclair/typebox';

export const testHistoryStationParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

export const testHistoryIdParamsSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
});

const testResultSchema = Type.Union([Type.Literal('pass'), Type.Literal('fail'), Type.Literal('warning')]);

export const testHistoryCreateBodySchema = Type.Object(
  {
    testDate: Type.Optional(Type.String({ format: 'date-time' })),
    result: testResultSchema,
    notes: Type.Optional(Type.String()),
    metricsJson: Type.Optional(Type.Any()),
  },
  { additionalProperties: false },
);

export const testHistoryUpdateBodySchema = Type.Object(
  {
    testDate: Type.Optional(Type.String({ format: 'date-time' })),
    result: Type.Optional(testResultSchema),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    metricsJson: Type.Optional(Type.Any()),
  },
  { additionalProperties: false },
);

export const testHistoryRecordSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  stationId: Type.String({ format: 'uuid' }),
  testDate: Type.String({ format: 'date-time' }),
  result: testResultSchema,
  notes: Type.Union([Type.String(), Type.Null()]),
  metricsJson: Type.Any(),
  testedBy: Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
});

export const testHistoryListResponseSchema = Type.Object({
  data: Type.Array(testHistoryRecordSchema),
});

export const testHistoryResponseSchema = Type.Object({
  data: testHistoryRecordSchema,
});

export const testHistoryDeleteResponseSchema = Type.Object({
  success: Type.Boolean(),
  id: Type.String({ format: 'uuid' }),
});
