import { Type } from '@sinclair/typebox';

import {
  createPaginatedResponseSchema,
  createSuccessResponseSchema,
  deleteResultDataSchema,
  isoDateTimeSchema,
  uuidSchema,
} from '../../utils/api-schemas';

const stationStatusSchema = Type.Union([
  Type.Literal('active'),
  Type.Literal('maintenance'),
  Type.Literal('inactive'),
  Type.Literal('faulty'),
  Type.Literal('archived'),
]);

const currentTypeSchema = Type.Union([Type.Literal('AC'), Type.Literal('DC')]);

const socketTypeSchema = Type.Union([
  Type.Literal('Type2'),
  Type.Literal('CCS2'),
  Type.Literal('CHAdeMO'),
  Type.Literal('GBT'),
  Type.Literal('NACS'),
  Type.Literal('Other'),
]);

const stationViewSchema = Type.Union([Type.Literal('full'), Type.Literal('compact')]);

const testResultSchema = Type.Union([Type.Literal('pass'), Type.Literal('fail'), Type.Literal('warning')]);

const stationSyncConflictFieldSchema = Type.Union([
  Type.Literal('status'),
  Type.Literal('location'),
  Type.Literal('lastTestDate'),
  Type.Literal('notes'),
  Type.Literal('customFields'),
  Type.Literal('attachments'),
  Type.Literal('issues'),
]);

const stationSyncSchema = Type.Object(
  {
    updatedAt: isoDateTimeSchema,
    archived: Type.Boolean(),
    archivedAt: Type.Union([isoDateTimeSchema, Type.Null()]),
    deleted: Type.Boolean(),
    deletedAt: Type.Union([isoDateTimeSchema, Type.Null()]),
    deleteMode: Type.Literal('hard_delete'),
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

export const stationListQuerySchema = Type.Object(
  {
    search: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    code: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })),
    qrCode: Type.Optional(Type.String({ minLength: 1, maxLength: 150 })),
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
      Type.Union([
        Type.Literal('name'),
        Type.Literal('createdAt'),
        Type.Literal('updatedAt'),
        Type.Literal('lastTestDate'),
        Type.Literal('powerKw'),
      ]),
    ),
    sortOrder: Type.Optional(Type.Union([Type.Literal('asc'), Type.Literal('desc')])),
    includeArchived: Type.Optional(Type.Boolean()),
    isArchived: Type.Optional(Type.Boolean()),
    createdFrom: Type.Optional(isoDateTimeSchema),
    createdTo: Type.Optional(isoDateTimeSchema),
    updatedSince: Type.Optional(isoDateTimeSchema),
    updatedFrom: Type.Optional(isoDateTimeSchema),
    updatedTo: Type.Optional(isoDateTimeSchema),
    powerMin: Type.Optional(Type.Number({ minimum: 0 })),
    powerMax: Type.Optional(Type.Number({ minimum: 0 })),
    page: Type.Optional(Type.Integer({ minimum: 1, maximum: 10_000 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
    view: Type.Optional(stationViewSchema),
  },
  {
    additionalProperties: true,
    description:
      'Station list filters. Use `view=compact` for mobile-friendly list items. Dynamic custom-field filters use the `cf.<key>=<value>` convention.',
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
    powerKw: Type.Number({ minimum: 0 }),
    currentType: currentTypeSchema,
    socketType: socketTypeSchema,
    location: Type.String({ minLength: 2, maxLength: 500 }),
    status: Type.Optional(stationStatusSchema),
    lastTestDate: Type.Optional(isoDateTimeSchema),
    notes: Type.Optional(Type.String({ maxLength: 2000 })),
    customFields: Type.Optional(Type.Record(Type.String(), Type.Any())),
  },
  { additionalProperties: false },
);

export const stationUpdateBodySchema = Type.Partial(stationCreateBodySchema);

const stationSummaryProperties = {
  ...stationCommonProperties,
  serialNumber: Type.String(),
  summary: stationMobileSummarySchema,
  sync: stationSyncSchema,
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

export const stationListItemSchema = Type.Object(
  {
    ...stationCommonProperties,
    serialNumber: Type.Optional(Type.String()),
    notes: Type.Optional(Type.Union([Type.String(), Type.Null()])),
    createdAt: Type.Optional(isoDateTimeSchema),
    customFields: Type.Optional(Type.Record(Type.String(), Type.Any())),
    summary: Type.Optional(stationMobileSummarySchema),
    sync: Type.Optional(stationSyncSchema),
  },
  {
    additionalProperties: false,
    description: 'Default list items include full station fields. `view=compact` returns the mobile-focused subset with `summary` and `sync`.',
  },
);

export const stationListResponseSchema = createPaginatedResponseSchema(stationListItemSchema);

export const stationResponseSchema = createSuccessResponseSchema(stationResponseDataSchema);

export const stationSummaryResponseSchema = createSuccessResponseSchema(stationSummaryDataSchema);

export const stationDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);
