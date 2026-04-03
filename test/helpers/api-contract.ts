import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';

import {
  bearerHeaders,
  loginAs,
  buildStationPayload,
  testCredentials,
} from './integration';

export type ApiErrorResponse = {
  code: string;
  message: string;
  details: unknown;
};

export type ApiSuccessResponse<T> = {
  data: T;
};

export type ApiPaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type LoginResponseData = {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
  session: {
    strategy: 'jwt-bearer';
    sessionVersion: 1;
    accessTokenExpiresIn: string;
    refreshTokenEnabled: boolean;
    refreshEndpoint: string | null;
  };
  user: {
    id: string;
    email: string;
    fullName: string;
    role: 'admin' | 'operator' | 'viewer';
    isActive: boolean;
  };
};

export type StationSummary = {
  totalIssueCount: number;
  openIssueCount: number;
  hasOpenIssues: boolean;
  attachmentCount: number;
  testHistoryCount: number;
  latestTestResult: 'pass' | 'fail' | 'warning' | null;
};

export type StationConnectorSummary = {
  types: Array<'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other'>;
  maxPowerKw: number;
  hasAC: boolean;
  hasDC: boolean;
  count: number;
};

export type StationConnector = {
  id: string;
  connectorNo: number;
  connectorType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
  currentType: 'AC' | 'DC';
  powerKw: number;
  isActive: boolean;
  sortOrder: number;
};

export type StationSync = {
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletionMode: 'hard_delete';
  conflictFields?: string[];
};

export type StationResponseData = {
  id: string;
  name: string;
  code: string;
  qrCode: string;
  brandId: string;
  modelId: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: number;
  currentType: 'AC' | 'DC';
  socketType: string;
  location: string;
  status: 'active' | 'maintenance' | 'inactive' | 'faulty';
  lastTestDate: string | null;
  notes?: string | null;
  modelTemplateVersion: number | null;
  connectorSummary: StationConnectorSummary;
  connectors?: StationConnector[];
  customFields?: Record<string, unknown>;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt?: string;
  updatedAt: string;
  summary: StationSummary;
  sync: StationSync;
};

export type TestHistoryResponseData = {
  id: string;
  stationId: string;
  testDate: string;
  result: 'pass' | 'fail' | 'warning';
  notes: string | null;
  metrics: Record<string, unknown>;
  testedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type IssueResponseData = {
  id: string;
  stationId: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  reportedBy: string | null;
  assignedTo: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AttachmentResponseData = {
  id: string;
  stationId: string;
  issueId: string | null;
  testHistoryId: string | null;
  targetType: 'station' | 'issue' | 'testHistory';
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string | null;
  createdAt: string;
  downloadUrl: string;
};

export type UserResponseData = {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'operator' | 'viewer';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomFieldResponseData = {
  id: string;
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'date' | 'json';
  options: Record<string, unknown>;
  isRequired: boolean;
  isFilterable: boolean;
  isVisibleInList: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AuditLogResponseData = {
  id: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type DashboardSummaryResponseData = {
  totalStations: number;
  activeStations: number;
  archivedStations: number;
  maintenanceStations: number;
  faultyStations: number;
  totalOpenIssues: number;
  totalCriticalIssues: number;
  recentTestCount: number;
};

type InjectResponse = {
  body: string;
  headers: Record<string, string | string[] | number | undefined>;
  statusCode: number;
};

const topLevelKeys = (value: object) => Object.keys(value).sort();

export const parseBody = <T>(response: { body: string }) => JSON.parse(response.body) as T;

export const assertIsoDateTime = (value: string | null) => {
  if (typeof value !== 'string') {
    assert.fail('Expected an ISO date-time string');
  }

  assert.ok(!Number.isNaN(Date.parse(value)));
};

export const assertStationSummary = (summary: StationSummary) => {
  assert.equal(typeof summary.totalIssueCount, 'number');
  assert.equal(typeof summary.openIssueCount, 'number');
  assert.equal(typeof summary.hasOpenIssues, 'boolean');
  assert.equal(typeof summary.attachmentCount, 'number');
  assert.equal(typeof summary.testHistoryCount, 'number');
  assert.ok(summary.latestTestResult === null || ['pass', 'fail', 'warning'].includes(summary.latestTestResult));
};

export const assertStationConnectorSummary = (summary: StationConnectorSummary) => {
  assert.equal(Array.isArray(summary.types), true);
  assert.equal(typeof summary.maxPowerKw, 'number');
  assert.equal(typeof summary.hasAC, 'boolean');
  assert.equal(typeof summary.hasDC, 'boolean');
  assert.equal(typeof summary.count, 'number');
};

export const assertStationSync = (sync: StationSync, expectConflictFields = false) => {
  assertIsoDateTime(sync.updatedAt);
  assert.equal(sync.isDeleted, false);
  assert.equal(sync.deletedAt, null);
  assert.equal(sync.deletionMode, 'hard_delete');
  assert.equal(typeof sync.isArchived, 'boolean');
  assert.ok(sync.archivedAt === null || !Number.isNaN(Date.parse(sync.archivedAt)));

  if (expectConflictFields) {
    assert.ok(Array.isArray(sync.conflictFields));
  } else {
    assert.equal('conflictFields' in sync, false);
  }
};

export const assertJsonResponse = (response: InjectResponse) => {
  const contentType = response.headers['content-type'];

  if (typeof contentType !== 'string') {
    assert.fail('Expected a JSON content-type header');
  }

  assert.match(contentType, /^application\/json\b/i);
};

export const expectSuccess = <T>(response: InjectResponse, statusCode: number) => {
  assert.equal(response.statusCode, statusCode);
  assertJsonResponse(response);
  const body = parseBody<ApiSuccessResponse<T>>(response);
  assert.deepEqual(topLevelKeys(body), ['data']);
  return body.data;
};

export const expectPaginated = <T>(response: InjectResponse, statusCode: number) => {
  assert.equal(response.statusCode, statusCode);
  assertJsonResponse(response);
  const body = parseBody<ApiPaginatedResponse<T>>(response);
  assert.deepEqual(topLevelKeys(body), ['data', 'meta']);
  assert.equal(Array.isArray(body.data), true);
  assert.equal(typeof body.meta.page, 'number');
  assert.equal(typeof body.meta.limit, 'number');
  assert.equal(typeof body.meta.total, 'number');
  assert.equal(typeof body.meta.totalPages, 'number');
  return body;
};

export const expectError = (
  response: InjectResponse,
  statusCode: number,
  code: string,
) => {
  assert.equal(response.statusCode, statusCode);
  assertJsonResponse(response);
  const body = parseBody<ApiErrorResponse>(response);
  assert.deepEqual(topLevelKeys(body), ['code', 'details', 'message']);
  assert.equal(body.code, code);
  assert.equal(typeof body.message, 'string');
  assert.ok('details' in body);
  return body;
};

export const expectRawResponse = (
  response: InjectResponse,
  statusCode: number,
  contentTypePrefix: string,
) => {
  assert.equal(response.statusCode, statusCode);
  const contentType = response.headers['content-type'];

  if (typeof contentType !== 'string') {
    assert.fail(`Expected content-type to start with ${contentTypePrefix}`);
  }

  assert.match(contentType, new RegExp(`^${contentTypePrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'));
  return response.body;
};

export const loginAndGetToken = async (
  app: FastifyInstance,
  user: keyof typeof testCredentials,
) => {
  const response = await loginAs(app, user);
  const data = expectSuccess<LoginResponseData>(response, 200);
  return {
    response,
    token: data.accessToken,
    user: data.user,
  };
};

export const buildMultipartUpload = (input: {
  content: Buffer | string;
  contentType: string;
  fieldName?: string;
  fileName: string;
}) => {
  const boundary = `----contract-freeze-${Math.random().toString(16).slice(2)}`;
  const header = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${input.fieldName ?? 'file'}"; filename="${input.fileName}"`,
    `Content-Type: ${input.contentType}`,
    '',
    '',
  ].join('\r\n');
  const footer = `\r\n--${boundary}--\r\n`;
  const content = typeof input.content === 'string' ? Buffer.from(input.content, 'utf-8') : input.content;
  const payload = Buffer.concat([
    Buffer.from(header, 'utf-8'),
    content,
    Buffer.from(footer, 'utf-8'),
  ]);

  return {
    headers: {
      'content-length': String(payload.byteLength),
      'content-type': `multipart/form-data; boundary=${boundary}`,
    },
    payload,
  };
};

export const authHeaders = (token: string, headers: Record<string, string> = {}) => ({
  ...headers,
  ...bearerHeaders(token),
});

export const createStation = async (
  app: FastifyInstance,
  token: string,
  suffix: string,
  overrides: Partial<ReturnType<typeof buildStationPayload>> = {},
) => {
  const response = await app.inject({
    method: 'POST',
    url: '/stations',
    headers: bearerHeaders(token),
    payload: {
      ...buildStationPayload(suffix),
      ...overrides,
    },
  });

  return expectSuccess<StationResponseData>(response, 201);
};

export const createTestHistory = async (
  app: FastifyInstance,
  token: string,
  stationId: string,
  payload: {
    testDate?: string;
    result: 'pass' | 'fail' | 'warning';
    notes?: string;
    metrics?: Record<string, unknown>;
  },
) => {
  const response = await app.inject({
    method: 'POST',
    url: `/stations/${stationId}/test-history`,
    headers: bearerHeaders(token),
    payload,
  });

  return expectSuccess<TestHistoryResponseData>(response, 201);
};

export const createIssue = async (
  app: FastifyInstance,
  token: string,
  stationId: string,
  payload: {
    title: string;
    description?: string;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    assignedTo?: string;
  },
) => {
  const response = await app.inject({
    method: 'POST',
    url: `/stations/${stationId}/issues`,
    headers: bearerHeaders(token),
    payload,
  });

  return expectSuccess<IssueResponseData>(response, 201);
};
