import { Type } from '@sinclair/typebox';

import {
  currentTypeValues,
  socketTypeValues,
  stationDeletionModeValues,
  stationStatusValues,
  stationSyncConflictFieldValues,
  stationTestResultValues,
  stationViewValues,
} from '../../contracts/domain';
import {
  createEnumSchema,
  createPaginatedResponseSchema,
  createSuccessResponseSchema,
  deleteResultDataSchema,
  isoDateTimeSchema,
  uuidSchema,
} from '../../utils/api-schemas';

const stationStatusSchema = createEnumSchema(stationStatusValues, {
  description: 'Canonical station operational status. Archive state is represented separately by `isArchived`.',
});

const currentTypeSchema = createEnumSchema(currentTypeValues);

const socketTypeSchema = createEnumSchema(socketTypeValues);

const stationViewSchema = createEnumSchema(stationViewValues);

const testResultSchema = createEnumSchema(stationTestResultValues);

const stationSyncConflictFieldSchema = createEnumSchema(stationSyncConflictFieldValues);

const stationDeletionModeSchema = createEnumSchema(stationDeletionModeValues);

const stationSyncSchema = Type.Object(
  {
    updatedAt: isoDateTimeSchema,
    isArchived: Type.Boolean(),
    archivedAt: Type.Union([isoDateTimeSchema, Type.Null()]),
    isDeleted: Type.Boolean(),
    deletedAt: Type.Union([isoDateTimeSchema, Type.Null()]),
    deletionMode: stationDeletionModeSchema,
    conflictFields: Type.Optional(Type.Array(stationSyncConflictFieldSchema, { minItems: 1, maxItems: 7 })),
  },
  { additionalProperties: false },
);

const stationMobileSummarySchema = Type.Object(
  {
    totalIssueCount: Type.Integer({ minimum: 0 }),
    openIssueCount: Type.Integer({ minimum: 0 }),
    hasOpenIssues: Type.Boolean(),
    attachmentCount: Type.Integer({ minimum: 0 }),
    testHistoryCount: Type.Integer({ minimum: 0 }),
    latestTestResult: Type.Union([testResultSchema, Type.Null()]),
  },
  { additionalProperties: false },
);

const stationCommonProperties = {
  id: uuidSchema,
  name: Type.String(),
  code: Type.String(),
  qrCode: Type.String(),
  brand: Type.String(),
  model: Type.String(),
  powerKw: Type.Number(),
  currentType: currentTypeSchema,
  socketType: socketTypeSchema,
  location: Type.String(),
  status: stationStatusSchema,
  lastTestDate: Type.Union([isoDateTimeSchema, Type.Null()]),
  isArchived: Type.Boolean(),
  archivedAt: Type.Union([isoDateTimeSchema, Type.Null()]),
  updatedAt: isoDateTimeSchema,
} as const;

const stationBaseListProperties = {
  ...stationCommonProperties,
  summary: stationMobileSummarySchema,
  sync: stationSyncSchema,
} as const;

export const stationListQuerySchema = Type.Object(
  {
    search: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    code: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    qrCode: Type.Optional(Type.String({ minLength: 1, maxLength: 150 })),
    model: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    ids: Type.Optional(
      Type.Union([
        Type.String({ minLength: 36, maxLength: 4000 }),
        Type.Array(uuidSchema, { minItems: 1, maxItems: 100 }),
      ]),
    ),
    status: Type.Optional(stationStatusSchema),
    brand: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    currentType: Type.Optional(currentTypeSchema),
    sortBy: Type.Optional(
      createEnumSchema(['name', 'createdAt', 'updatedAt', 'lastTestDate', 'powerKw'] as const),
    ),
    sortOrder: Type.Optional(createEnumSchema(['asc', 'desc'] as const)),
    includeArchived: Type.Optional(Type.Boolean()),
    isArchived: Type.Optional(Type.Boolean()),
    createdFrom: Type.Optional(isoDateTimeSchema),
    createdTo: Type.Optional(isoDateTimeSchema),
    updatedFrom: Type.Optional(isoDateTimeSchema),
    updatedTo: Type.Optional(isoDateTimeSchema),
    powerMin: Type.Optional(Type.Number({ minimum: 0, maximum: 1000 })),
    powerMax: Type.Optional(Type.Number({ minimum: 0, maximum: 1000 })),
    page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    view: Type.Optional(stationViewSchema),
  },
  {
    additionalProperties: true,
    description:
      'Station list filters. `status` is operational-only. Archive lifecycle is represented by `isArchived` and `includeArchived`. Dynamic custom-field filters use the `cf.<key>=<value>` convention.',
  },
);

export const stationIdParamsSchema = Type.Object(
  {
    id: uuidSchema,
  },
  { additionalProperties: false },
);

export const stationQrLookupParamsSchema = Type.Object(
  {
    value: Type.String({ minLength: 1, maxLength: 150 }),
  },
  { additionalProperties: false },
);

export const stationCreateBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 2, maxLength: 160 }),
    code: Type.String({ minLength: 2, maxLength: 80 }),
    qrCode: Type.String({ minLength: 2, maxLength: 150 }),
    brand: Type.String({ minLength: 1, maxLength: 120 }),
    model: Type.String({ minLength: 1, maxLength: 120 }),
    serialNumber: Type.String({ minLength: 2, maxLength: 150 }),
    powerKw: Type.Number({ minimum: 0, maximum: 1000 }),
    currentType: currentTypeSchema,
    socketType: socketTypeSchema,
    location: Type.String({ minLength: 2, maxLength: 500 }),
    status: Type.Optional(stationStatusSchema),
    lastTestDate: Type.Optional(Type.Union([isoDateTimeSchema, Type.Null()])),
    notes: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
    customFields: Type.Optional(Type.Record(Type.String(), Type.Any())),
  },
  { additionalProperties: false },
);

export const stationUpdateBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 2, maxLength: 160 })),
    code: Type.Optional(Type.String({ minLength: 2, maxLength: 80 })),
    qrCode: Type.Optional(Type.String({ minLength: 2, maxLength: 150 })),
    brand: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    model: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    serialNumber: Type.Optional(Type.String({ minLength: 2, maxLength: 150 })),
    powerKw: Type.Optional(Type.Number({ minimum: 0, maximum: 1000 })),
    currentType: Type.Optional(currentTypeSchema),
    socketType: Type.Optional(socketTypeSchema),
    location: Type.Optional(Type.String({ minLength: 2, maxLength: 500 })),
    status: Type.Optional(stationStatusSchema),
    lastTestDate: Type.Optional(Type.Union([isoDateTimeSchema, Type.Null()])),
    notes: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
    customFields: Type.Optional(Type.Record(Type.String(), Type.Any())),
  },
  {
    additionalProperties: false,
    minProperties: 1,
  },
);

const stationSummaryProperties = {
  ...stationBaseListProperties,
  serialNumber: Type.String(),
} as const;

export const stationSummaryDataSchema = Type.Object(stationSummaryProperties, { additionalProperties: false });

export const stationResponseDataSchema = Type.Object(
  {
    ...stationSummaryProperties,
    notes: Type.Union([Type.String(), Type.Null()]),
    createdAt: isoDateTimeSchema,
    customFields: Type.Record(Type.String(), Type.Any()),
  },
  { additionalProperties: false },
);

export const stationCompactListItemSchema = Type.Object(stationBaseListProperties, {
  additionalProperties: false,
});

export const stationFullListItemSchema = Type.Object(
  {
    ...stationBaseListProperties,
    serialNumber: Type.String(),
    notes: Type.Union([Type.String(), Type.Null()]),
    createdAt: isoDateTimeSchema,
    customFields: Type.Record(Type.String(), Type.Any()),
  },
  {
    additionalProperties: false,
  },
);

export const stationListItemSchema = Type.Union([stationFullListItemSchema, stationCompactListItemSchema], {
  description:
    'Station list items always include `summary` and `sync`. `view=compact` returns the compact item shape; the default view returns the full item shape.',
});

export const stationListResponseSchema = createPaginatedResponseSchema(stationListItemSchema);

export const stationResponseSchema = createSuccessResponseSchema(stationResponseDataSchema);

export const stationSummaryResponseSchema = createSuccessResponseSchema(stationSummaryDataSchema);

export const stationDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);
