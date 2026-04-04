import { Type } from '@sinclair/typebox';

import {
  connectorTypeValues,
  currentTypeValues,
  stationStatusValues,
  stationTestResultValues,
  stationViewValues,
} from '../../contracts/domain';
import {
  createEnumSchema,
  createCollectionResponseSchema,
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

const connectorTypeSchema = createEnumSchema(connectorTypeValues);

const stationViewSchema = createEnumSchema(stationViewValues);

const testResultSchema = createEnumSchema(stationTestResultValues);

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

export const stationConnectorSummarySchema = Type.Object(
  {
    types: Type.Array(connectorTypeSchema),
    maxPowerKw: Type.Number({ minimum: 0 }),
    hasAC: Type.Boolean(),
    hasDC: Type.Boolean(),
    count: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

export const stationConnectorSchema = Type.Object(
  {
    id: uuidSchema,
    connectorNo: Type.Integer({ minimum: 1 }),
    connectorType: connectorTypeSchema,
    currentType: currentTypeSchema,
    powerKw: Type.Number({ exclusiveMinimum: 0, maximum: 1000 }),
    isActive: Type.Boolean(),
    sortOrder: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export const stationConnectorInputSchema = Type.Object(
  {
    connectorNo: Type.Integer({ minimum: 1 }),
    connectorType: connectorTypeSchema,
    currentType: currentTypeSchema,
    powerKw: Type.Number({ exclusiveMinimum: 0, maximum: 1000 }),
    isActive: Type.Optional(Type.Boolean()),
    sortOrder: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export const stationCatalogBrandSchema = Type.Object(
  {
    id: uuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    isActive: Type.Boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const stationCatalogModelSchema = Type.Object(
  {
    id: uuidSchema,
    brandId: uuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    description: Type.Union([Type.String({ maxLength: 4000 }), Type.Null()]),
    imageUrl: Type.Union([Type.String({ maxLength: 2000 }), Type.Null()]),
    isActive: Type.Boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
    latestTemplateVersion: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
    latestTemplateConnectors: Type.Array(stationConnectorInputSchema),
  },
  { additionalProperties: false },
);

export const stationConfigDataSchema = Type.Object(
  {
    statuses: Type.Array(stationStatusSchema),
    currentTypes: Type.Array(currentTypeSchema),
    connectorTypes: Type.Array(connectorTypeSchema),
    brands: Type.Array(stationCatalogBrandSchema),
    models: Type.Array(stationCatalogModelSchema),
  },
  { additionalProperties: false },
);

const stationCommonProperties = {
  id: uuidSchema,
  name: Type.String(),
  code: Type.String(),
  qrCode: Type.String(),
  brandId: uuidSchema,
  modelId: uuidSchema,
  brand: Type.String(),
  model: Type.String(),
  powerKw: Type.Number(),
  currentType: currentTypeSchema,
  socketType: Type.String(),
  location: Type.String(),
  status: stationStatusSchema,
  lastTestDate: Type.Union([isoDateTimeSchema, Type.Null()]),
  isArchived: Type.Boolean(),
  archivedAt: Type.Union([isoDateTimeSchema, Type.Null()]),
  updatedAt: isoDateTimeSchema,
  modelTemplateVersion: Type.Union([Type.Integer({ minimum: 1 }), Type.Null()]),
  connectorSummary: stationConnectorSummarySchema,
} as const;

const stationBaseListProperties = {
  ...stationCommonProperties,
  summary: stationMobileSummarySchema,
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
    brandId: Type.Optional(uuidSchema),
    modelId: Type.Optional(uuidSchema),
    brand: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    model: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    serialNumber: Type.String({ minLength: 2, maxLength: 150 }),
    location: Type.String({ minLength: 2, maxLength: 500 }),
    status: Type.Optional(stationStatusSchema),
    lastTestDate: Type.Optional(Type.Union([isoDateTimeSchema, Type.Null()])),
    notes: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
    connectors: Type.Optional(Type.Array(stationConnectorInputSchema, { minItems: 1, maxItems: 20 })),
    customFields: Type.Optional(Type.Record(Type.String(), Type.Any())),
  },
  { additionalProperties: false },
);

export const stationUpdateBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 2, maxLength: 160 })),
    code: Type.Optional(Type.String({ minLength: 2, maxLength: 80 })),
    qrCode: Type.Optional(Type.String({ minLength: 2, maxLength: 150 })),
    brandId: Type.Optional(uuidSchema),
    modelId: Type.Optional(uuidSchema),
    brand: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    model: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    serialNumber: Type.Optional(Type.String({ minLength: 2, maxLength: 150 })),
    location: Type.Optional(Type.String({ minLength: 2, maxLength: 500 })),
    status: Type.Optional(stationStatusSchema),
    lastTestDate: Type.Optional(Type.Union([isoDateTimeSchema, Type.Null()])),
    notes: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
    connectors: Type.Optional(Type.Array(stationConnectorInputSchema, { minItems: 1, maxItems: 20 })),
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
    connectors: Type.Array(stationConnectorSchema),
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
    'Station list items always include `summary`. `view=compact` returns the compact item shape; the default view returns the full item shape.',
});

export const stationListResponseSchema = createPaginatedResponseSchema(stationListItemSchema);

export const stationResponseSchema = createSuccessResponseSchema(stationResponseDataSchema);

export const stationSummaryResponseSchema = createSuccessResponseSchema(stationSummaryDataSchema);

export const stationDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);

export const stationConfigResponseSchema = createSuccessResponseSchema(stationConfigDataSchema);

export const stationCatalogDeleteResponseSchema = createSuccessResponseSchema(deleteResultDataSchema);

export const stationCatalogBrandResponseSchema = createSuccessResponseSchema(stationCatalogBrandSchema);

export const stationCatalogBrandCollectionResponseSchema = createCollectionResponseSchema(stationCatalogBrandSchema);

export const stationCatalogModelResponseSchema = createSuccessResponseSchema(stationCatalogModelSchema);

export const stationCatalogModelCollectionResponseSchema = createCollectionResponseSchema(stationCatalogModelSchema);

export const stationCatalogBrandCreateBodySchema = Type.Object(
  {
    name: Type.String({ minLength: 1, maxLength: 120 }),
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const stationCatalogBrandUpdateBodySchema = Type.Object(
  {
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    isActive: Type.Optional(Type.Boolean()),
  },
  {
    additionalProperties: false,
    minProperties: 1,
  },
);

const catalogDescriptionSchema = Type.Union([Type.String({ maxLength: 4000 }), Type.Null()]);

export const stationCatalogModelCreateBodySchema = Type.Object(
  {
    brandId: uuidSchema,
    name: Type.String({ minLength: 1, maxLength: 120 }),
    description: Type.Optional(catalogDescriptionSchema),
    imageUrl: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
    isActive: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const stationCatalogModelUpdateBodySchema = Type.Object(
  {
    brandId: Type.Optional(uuidSchema),
    name: Type.Optional(Type.String({ minLength: 1, maxLength: 120 })),
    description: Type.Optional(catalogDescriptionSchema),
    imageUrl: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
    isActive: Type.Optional(Type.Boolean()),
  },
  {
    additionalProperties: false,
    minProperties: 1,
  },
);

export const stationCatalogModelTemplateUpdateBodySchema = Type.Object(
  {
    connectors: Type.Array(stationConnectorInputSchema, { minItems: 1, maxItems: 20 }),
  },
  { additionalProperties: false },
);
