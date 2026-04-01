import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { FastifyInstance } from 'fastify';

import { env } from '../../src/config/env';
import {
  bearerHeaders,
  buildStationPayload,
  createTestApp,
  fixtureIds,
  loginAs,
  resetIntegrationDb,
  testCredentials,
} from '../helpers/integration';

type ApiErrorResponse = {
  code: string;
  message: string;
  details: unknown;
};

type ApiSuccessResponse<T> = {
  data: T;
};

type ApiPaginatedResponse<T> = {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type LoginResponseData = {
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

type StationSummary = {
  totalIssueCount: number;
  openIssueCount: number;
  hasOpenIssues: boolean;
  attachmentCount: number;
  testHistoryCount: number;
  latestTestResult: 'pass' | 'fail' | 'warning' | null;
};

type StationSync = {
  updatedAt: string;
  isArchived: boolean;
  archivedAt: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deletionMode: 'hard_delete';
  conflictFields?: string[];
};

type StationResponseData = {
  id: string;
  name: string;
  code: string;
  qrCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: number;
  currentType: 'AC' | 'DC';
  socketType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
  location: string;
  status: 'active' | 'maintenance' | 'inactive' | 'faulty';
  lastTestDate: string | null;
  notes?: string | null;
  customFields?: Record<string, unknown>;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt?: string;
  updatedAt: string;
  summary: StationSummary;
  sync: StationSync;
};

type TestHistoryResponseData = {
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

type IssueResponseData = {
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

const parseBody = <T>(response: { body: string }) => JSON.parse(response.body) as T;

const assertIsoDateTime = (value: string | null) => {
  assert.equal(typeof value, 'string');
  assert.ok(!Number.isNaN(Date.parse(value)));
};

const expectSuccess = <T>(response: { body: string; statusCode: number }, statusCode: number) => {
  assert.equal(response.statusCode, statusCode);
  const body = parseBody<ApiSuccessResponse<T>>(response);
  assert.deepEqual(Object.keys(body), ['data']);
  return body.data;
};

const expectError = (
  response: { body: string; statusCode: number },
  statusCode: number,
  code: string,
) => {
  assert.equal(response.statusCode, statusCode);
  const body = parseBody<ApiErrorResponse>(response);
  assert.equal(body.code, code);
  assert.equal(typeof body.message, 'string');
  assert.ok('details' in body);
  return body;
};

const loginAndGetToken = async (
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

const assertStationSummary = (summary: StationSummary) => {
  assert.equal(typeof summary.totalIssueCount, 'number');
  assert.equal(typeof summary.openIssueCount, 'number');
  assert.equal(typeof summary.hasOpenIssues, 'boolean');
  assert.equal(typeof summary.attachmentCount, 'number');
  assert.equal(typeof summary.testHistoryCount, 'number');
  assert.ok(summary.latestTestResult === null || ['pass', 'fail', 'warning'].includes(summary.latestTestResult));
};

const assertStationSync = (sync: StationSync) => {
  assertIsoDateTime(sync.updatedAt);
  assert.equal(sync.isDeleted, false);
  assert.equal(sync.deletedAt, null);
  assert.equal(sync.deletionMode, 'hard_delete');
  assert.equal(typeof sync.isArchived, 'boolean');
  assert.ok(sync.archivedAt === null || !Number.isNaN(Date.parse(sync.archivedAt)));
};

test('backend integration contract baseline', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('login success', async () => {
    await resetIntegrationDb();

    const response = await loginAs(app, 'admin');
    const data = expectSuccess<LoginResponseData>(response, 200);

    assert.match(data.accessToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(data.tokenType, 'Bearer');
    assert.equal(data.user.email, testCredentials.admin.email);
    assert.equal(data.user.role, 'admin');
    assert.equal(data.user.isActive, true);
    assert.equal(data.session.strategy, 'jwt-bearer');
    assert.equal(data.session.refreshTokenEnabled, false);
    assert.equal(data.session.refreshEndpoint, null);
  });

  await t.test('login failure and rate limiting', async () => {
    await resetIntegrationDb();

    const blockedEmail = 'blocked.integration@evlab.local';

    for (let attempt = 1; attempt < env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS; attempt += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        payload: {
          email: blockedEmail,
          password: 'WrongPassword123!',
        },
      });

      const error = expectError(response, 401, 'INVALID_CREDENTIALS');
      assert.equal(error.message, 'Invalid email or password');
    }

    const blockedResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: blockedEmail,
        password: 'WrongPassword123!',
      },
    });

    const blocked = expectError(blockedResponse, 429, 'LOGIN_RATE_LIMITED');
    assert.equal(typeof (blocked.details as { retryAfterSeconds?: number } | null)?.retryAfterSeconds, 'number');
  });

  await t.test('get current user', async () => {
    await resetIntegrationDb();

    const { token, user } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<{ user: LoginResponseData['user'] }>(response, 200);

    assert.deepEqual(data.user, user);
  });

  await t.test('list stations filtered by model', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const createResponse = await app.inject({
      method: 'POST',
      url: '/stations',
      headers: bearerHeaders(token),
      payload: buildStationPayload('MOD'),
    });
    expectSuccess<StationResponseData>(createResponse, 201);

    const response = await app.inject({
      method: 'GET',
      url: '/stations?model=Terra%2054',
      headers: bearerHeaders(token),
    });

    assert.equal(response.statusCode, 200);
    const body = parseBody<ApiPaginatedResponse<StationResponseData>>(response);

    assert.equal(body.meta.total, 1);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0]?.id, fixtureIds.stations.existing);
    assert.equal(body.data[0]?.model, 'Terra 54');
  });

  await t.test('create station', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const payload = buildStationPayload('CRT');
    const response = await app.inject({
      method: 'POST',
      url: '/stations',
      headers: bearerHeaders(token),
      payload,
    });
    const data = expectSuccess<StationResponseData>(response, 201);

    assert.equal(data.code, payload.code);
    assert.equal(data.qrCode, payload.qrCode);
    assert.equal(data.serialNumber, payload.serialNumber);
    assert.equal(data.powerKw, payload.powerKw);
    assert.equal(data.notes, payload.notes);
    assert.equal(data.customFields?.firmware_version, payload.customFields.firmware_version);
    assert.equal(data.customFields?.cooling_type, payload.customFields.cooling_type);
    assert.equal(data.isArchived, false);
    assertIsoDateTime(data.createdAt ?? null);
    assertIsoDateTime(data.updatedAt);
    assertStationSummary(data.summary);
    assertStationSync(data.sync);
  });

  await t.test('duplicate station rejection', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const payload = {
      ...buildStationPayload('DUP'),
      code: 'INT-EX-001',
    };
    const response = await app.inject({
      method: 'POST',
      url: '/stations',
      headers: bearerHeaders(token),
      payload,
    });

    const error = expectError(response, 409, 'STATION_CODE_EXISTS');
    assert.equal(error.message, 'Station code already exists');
  });

  await t.test('update station', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'PUT',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
      payload: {
        name: 'Updated Integration Station',
        status: 'maintenance',
        powerKw: 75.5,
        notes: 'Updated in integration test',
      },
    });
    const data = expectSuccess<StationResponseData>(response, 200);

    assert.equal(data.name, 'Updated Integration Station');
    assert.equal(data.status, 'maintenance');
    assert.equal(data.powerKw, 75.5);
    assert.equal(data.notes, 'Updated in integration test');
    assert.equal(data.customFields?.firmware_version, 'v1.0.0');
    assertStationSummary(data.summary);
    assertStationSync(data.sync);
  });

  await t.test('clear nullable station fields with null', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'PUT',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
      payload: {
        notes: null,
        lastTestDate: null,
      },
    });
    const data = expectSuccess<StationResponseData>(response, 200);

    assert.equal(data.notes, null);
    assert.equal(data.lastTestDate, null);
    assert.equal(data.customFields?.commissioning_date, '2026-01-15T00:00:00.000Z');
  });

  await t.test('clear non-required custom field with null', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'PUT',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
      payload: {
        customFields: {
          commissioning_date: null,
        },
      },
    });
    const data = expectSuccess<StationResponseData>(response, 200);

    assert.equal(data.customFields?.commissioning_date, undefined);
    assert.equal(data.customFields?.firmware_version, 'v1.0.0');
  });

  await t.test('reject clearing required custom field with null', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'PUT',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
      payload: {
        customFields: {
          firmware_version: null,
        },
      },
    });

    const error = expectError(response, 400, 'CUSTOM_FIELD_REQUIRED');
    assert.equal(error.message, 'Custom field firmware_version is required');
  });

  await t.test('QR lookup', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'GET',
      url: '/stations/lookup/qr/QR-INT-EX-001',
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<StationResponseData>(response, 200);

    assert.equal(data.id, fixtureIds.stations.existing);
    assert.equal(data.code, 'INT-EX-001');
    assert.equal(data.serialNumber, 'ABB-INT-0001');
    assert.equal('customFields' in data, false);
    assert.equal('notes' in data, false);
    assertStationSummary(data.summary);
    assertStationSync(data.sync);
    assert.ok(Array.isArray(data.sync.conflictFields));
  });

  await t.test('get station detail', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'GET',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<StationResponseData>(response, 200);

    assert.equal(data.id, fixtureIds.stations.existing);
    assert.equal(data.notes, 'Seeded station for integration tests.');
    assert.equal(data.customFields?.firmware_version, 'v1.0.0');
    assert.equal(data.customFields?.cooling_type, 'air');
    assert.equal(data.customFields?.commissioning_date, '2026-01-15T00:00:00.000Z');
    assertStationSummary(data.summary);
    assertStationSync(data.sync);
  });

  await t.test('add test history record', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const createResponse = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/test-history`,
      headers: bearerHeaders(token),
      payload: {
        testDate: '2026-03-25T09:15:00.000Z',
        result: 'pass',
        notes: 'Validated during integration test',
        metrics: {
          amperage: 32,
          voltage: 400,
        },
      },
    });
    const created = expectSuccess<TestHistoryResponseData>(createResponse, 201);

    assert.equal(created.stationId, fixtureIds.stations.existing);
    assert.equal(created.result, 'pass');
    assert.equal(created.notes, 'Validated during integration test');
    assert.deepEqual(created.metrics, { amperage: 32, voltage: 400 });
    assert.equal(created.testedBy, fixtureIds.users.operator);
    assertIsoDateTime(created.testDate);
    assertIsoDateTime(created.createdAt);
    assertIsoDateTime(created.updatedAt);

    const stationResponse = await app.inject({
      method: 'GET',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
    });
    const station = expectSuccess<StationResponseData>(stationResponse, 200);

    assert.equal(station.lastTestDate, '2026-03-25T09:15:00.000Z');
    assert.equal(station.summary.testHistoryCount, 1);
    assert.equal(station.summary.latestTestResult, 'pass');
  });

  await t.test('add issue record', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const createResponse = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/issues`,
      headers: bearerHeaders(token),
      payload: {
        title: 'Cable strain issue',
        description: 'Observed at connector housing.',
        severity: 'high',
      },
    });
    const created = expectSuccess<IssueResponseData>(createResponse, 201);

    assert.equal(created.stationId, fixtureIds.stations.existing);
    assert.equal(created.title, 'Cable strain issue');
    assert.equal(created.description, 'Observed at connector housing.');
    assert.equal(created.severity, 'high');
    assert.equal(created.status, 'open');
    assert.equal(created.reportedBy, fixtureIds.users.operator);
    assert.equal(created.assignedTo, null);
    assert.equal(created.resolvedAt, null);
    assertIsoDateTime(created.createdAt);
    assertIsoDateTime(created.updatedAt);

    const stationResponse = await app.inject({
      method: 'GET',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
    });
    const station = expectSuccess<StationResponseData>(stationResponse, 200);

    assert.equal(station.summary.totalIssueCount, 1);
    assert.equal(station.summary.openIssueCount, 1);
    assert.equal(station.summary.hasOpenIssues, true);
  });

  await t.test('archive station', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/archive`,
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<StationResponseData>(response, 200);

    assert.equal(data.status, 'inactive');
    assert.equal(data.isArchived, true);
    assertIsoDateTime(data.archivedAt);
    assert.equal(data.sync.isArchived, true);
  });

  await t.test('unauthorized and forbidden access', async () => {
    await resetIntegrationDb();

    const meResponse = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });
    expectError(meResponse, 401, 'UNAUTHORIZED');

    const viewerSession = await loginAndGetToken(app, 'viewer');
    const viewerCreateResponse = await app.inject({
      method: 'POST',
      url: '/stations',
      headers: bearerHeaders(viewerSession.token),
      payload: buildStationPayload('VIEW'),
    });
    expectError(viewerCreateResponse, 403, 'FORBIDDEN');

    const operatorSession = await loginAndGetToken(app, 'operator');
    const dashboardResponse = await app.inject({
      method: 'GET',
      url: '/dashboard/summary',
      headers: bearerHeaders(operatorSession.token),
    });
    expectError(dashboardResponse, 403, 'FORBIDDEN');

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(operatorSession.token),
    });
    expectError(deleteResponse, 403, 'FORBIDDEN');
  });
});
