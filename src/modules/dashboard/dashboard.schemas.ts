import { Type } from '@sinclair/typebox';

const dashboardSummarySchema = Type.Object({
  totalStations: Type.Integer({ minimum: 0 }),
  activeStations: Type.Integer({ minimum: 0 }),
  archivedStations: Type.Integer({ minimum: 0 }),
  maintenanceStations: Type.Integer({ minimum: 0 }),
  faultyStations: Type.Integer({ minimum: 0 }),
  totalOpenIssues: Type.Integer({ minimum: 0 }),
  totalCriticalIssues: Type.Integer({ minimum: 0 }),
  recentTestCount: Type.Integer({ minimum: 0 }),
});

const recentQuerySchema = Type.Object(
  {
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

const recentStationSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String(),
  code: Type.String(),
  status: Type.String(),
  isArchived: Type.Boolean(),
  updatedAt: Type.String({ format: 'date-time' }),
});

const recentIssueSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  stationId: Type.String({ format: 'uuid' }),
  stationName: Type.String(),
  title: Type.String(),
  severity: Type.String(),
  status: Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
});

const recentTestSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  stationId: Type.String({ format: 'uuid' }),
  stationName: Type.String(),
  result: Type.String(),
  testDate: Type.String({ format: 'date-time' }),
  createdAt: Type.String({ format: 'date-time' }),
});

export const dashboardSummaryResponseSchema = Type.Object({
  data: dashboardSummarySchema,
});

export const dashboardRecentStationsQuerySchema = recentQuerySchema;
export const dashboardRecentIssuesQuerySchema = recentQuerySchema;
export const dashboardRecentTestsQuerySchema = recentQuerySchema;

export const dashboardRecentStationsResponseSchema = Type.Object({
  data: Type.Array(recentStationSchema),
});

export const dashboardRecentIssuesResponseSchema = Type.Object({
  data: Type.Array(recentIssueSchema),
});

export const dashboardRecentTestsResponseSchema = Type.Object({
  data: Type.Array(recentTestSchema),
});
