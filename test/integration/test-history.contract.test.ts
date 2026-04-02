import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assertIsoDateTime,
  expectError,
  expectSuccess,
  loginAndGetToken,
  createTestHistory,
  type StationResponseData,
  type TestHistoryResponseData,
} from '../helpers/api-contract';
import {
  bearerHeaders,
  createTestApp,
  fixtureIds,
  resetIntegrationDb,
} from '../helpers/integration';

test('test history contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('create and list station test history records', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const created = await createTestHistory(app, token, fixtureIds.stations.existing, {
      testDate: '2026-03-25T09:15:00.000Z',
      result: 'pass',
      notes: 'Validated during integration test',
      metrics: {
        amperage: 32,
        voltage: 400,
      },
    });

    assert.equal(created.stationId, fixtureIds.stations.existing);
    assert.equal(created.result, 'pass');
    assert.equal(created.notes, 'Validated during integration test');
    assert.deepEqual(created.metrics, { amperage: 32, voltage: 400 });
    assert.equal(created.testedBy, fixtureIds.users.operator);
    assertIsoDateTime(created.testDate);
    assertIsoDateTime(created.createdAt);
    assertIsoDateTime(created.updatedAt);

    const listResponse = await app.inject({
      method: 'GET',
      url: `/stations/${fixtureIds.stations.existing}/test-history`,
      headers: bearerHeaders(token),
    });
    const list = expectSuccess<TestHistoryResponseData[]>(listResponse, 200);

    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, created.id);
    assert.equal(list[0]?.notes, 'Validated during integration test');

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

  await t.test('update test history supports nullable notes', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const created = await createTestHistory(app, token, fixtureIds.stations.existing, {
      result: 'warning',
      notes: 'Needs follow-up',
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/test-history/${created.id}`,
      headers: bearerHeaders(token),
      payload: {
        result: 'fail',
        notes: null,
        metrics: {
          leakage: true,
        },
      },
    });
    const updated = expectSuccess<TestHistoryResponseData>(response, 200);

    assert.equal(updated.result, 'fail');
    assert.equal(updated.notes, null);
    assert.deepEqual(updated.metrics, { leakage: true });
  });

  await t.test('test history write endpoints reject unexpected payload properties', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const created = await createTestHistory(app, token, fixtureIds.stations.existing, {
      result: 'warning',
    });

    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/stations/${fixtureIds.stations.existing}/test-history`,
        headers: bearerHeaders(token),
        payload: {
          result: 'pass',
          unexpected: true,
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/test-history/${created.id}`,
        headers: bearerHeaders(token),
        payload: {
          result: 'fail',
          unexpected: true,
        },
      }),
    ]);

    for (const response of responses) {
      expectError(response, 400, 'VALIDATION_ERROR');
    }
  });

  await t.test('delete test history returns wrapped delete contract and updates station summary', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const created = await createTestHistory(app, token, fixtureIds.stations.existing, {
      result: 'warning',
    });

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/test-history/${created.id}`,
      headers: bearerHeaders(token),
    });
    const deleted = expectSuccess<{ success: true; id: string }>(deleteResponse, 200);

    assert.deepEqual(deleted, {
      success: true,
      id: created.id,
    });

    const stationResponse = await app.inject({
      method: 'GET',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
    });
    const station = expectSuccess<StationResponseData>(stationResponse, 200);

    assert.equal(station.summary.testHistoryCount, 0);
    assert.equal(station.summary.latestTestResult, null);
  });

  await t.test('viewer cannot create, update, or delete test history records', async () => {
    await resetIntegrationDb();

    const { token: operatorToken } = await loginAndGetToken(app, 'operator');
    const created = await createTestHistory(app, operatorToken, fixtureIds.stations.existing, {
      result: 'warning',
    });

    const { token: viewerToken } = await loginAndGetToken(app, 'viewer');
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/stations/${fixtureIds.stations.existing}/test-history`,
        headers: bearerHeaders(viewerToken),
        payload: {
          result: 'pass',
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/test-history/${created.id}`,
        headers: bearerHeaders(viewerToken),
        payload: {
          result: 'fail',
        },
      }),
      app.inject({
        method: 'DELETE',
        url: `/test-history/${created.id}`,
        headers: bearerHeaders(viewerToken),
      }),
    ]);

    for (const response of responses) {
      expectError(response, 403, 'FORBIDDEN');
    }
  });
});
