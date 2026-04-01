import { Type } from '@sinclair/typebox';

import { issueSeverityValues, issueStatusValues, stationStatusValues, stationTestResultValues } from '../../contracts/domain';
import {
  createCollectionResponseSchema,
  createEnumSchema,
  createSuccessResponseSchema,
  isoDateTimeSchema,
  uuidSchema,
} from '../../utils/api-schemas';

const stationStatusSchema = createEnumSchema(stationStatusValues);

const issueSeveritySchema = createEnumSchema(issueSeverityValues);

const issueStatusSchema = createEnumSchema(issueStatusValues);

const testResultSchema = createEnumSchema(stationTestResultValues);

const dashboardSummarySchema = Type.Object(
  {
    totalStations: Type.Integer({ minimum: 0 }),
    activeStations: Type.Integer({ minimum: 0 }),
    archivedStations: Type.Integer({ minimum: 0 }),
    maintenanceStations: Type.Integer({ minimum: 0 }),
    faultyStations: Type.Integer({ minimum: 0 }),
    totalOpenIssues: Type.Integer({ minimum: 0 }),
    totalCriticalIssues: Type.Integer({ minimum: 0 }),
    recentTestCount: Type.Integer({ minimum: 0 }),
  },
  { additionalProperties: false },
);

const recentQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

const recentStationSchema = Type.Object(
  {
    id: uuidSchema,
    name: Type.String(),
    code: Type.String(),
    status: stationStatusSchema,
    isArchived: Type.Boolean(),
    updatedAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

const recentIssueSchema = Type.Object(
  {
    id: uuidSchema,
    stationId: uuidSchema,
    stationName: Type.String(),
    title: Type.String(),
    severity: issueSeveritySchema,
    status: issueStatusSchema,
    createdAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

const recentTestSchema = Type.Object(
  {
    id: uuidSchema,
    stationId: uuidSchema,
    stationName: Type.String(),
    result: testResultSchema,
    testDate: isoDateTimeSchema,
    createdAt: isoDateTimeSchema,
  },
  { additionalProperties: false },
);

export const dashboardSummaryResponseSchema = createSuccessResponseSchema(dashboardSummarySchema);

export const dashboardRecentStationsQuerySchema = recentQuerySchema;
export const dashboardRecentIssuesQuerySchema = recentQuerySchema;
export const dashboardRecentTestsQuerySchema = recentQuerySchema;

export const dashboardRecentStationsResponseSchema = createCollectionResponseSchema(recentStationSchema);

export const dashboardRecentIssuesResponseSchema = createCollectionResponseSchema(recentIssueSchema);

export const dashboardRecentTestsResponseSchema = createCollectionResponseSchema(recentTestSchema);
