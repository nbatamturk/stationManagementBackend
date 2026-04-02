import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  currentTypeValues,
  socketTypeValues,
  stationStatusValues,
  stationTestResultValues,
} from '../../src/contracts/domain';
import {
  assertIsoDateTime,
  assertStationSummary,
  assertStationSync,
  expectError,
  expectPaginated,
  expectSuccess,
  loginAndGetToken,
  type StationResponseData,
} from '../helpers/api-contract';
import {
  bearerHeaders,
  buildStationPayload,
  createTestApp,
  fixtureIds,
  resetIntegrationDb,
} from '../helpers/integration';

test('stations contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('list stations filtered by model uses paginated contract', async () => {
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
    const body = expectPaginated<StationResponseData>(response, 200);

    assert.equal(body.meta.total, 1);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0]?.id, fixtureIds.stations.existing);
    assert.equal(body.data[0]?.model, 'Terra 54');
    assertStationSummary(body.data[0]!.summary);
    assertStationSync(body.data[0]!.sync);
  });

  await t.test('create station returns the full station contract', async () => {
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
    assert.equal(currentTypeValues.includes(data.currentType), true);
    assert.equal(socketTypeValues.includes(data.socketType), true);
    assert.equal(stationStatusValues.includes(data.status), true);
    assert.equal(data.isArchived, false);
    assertIsoDateTime(data.createdAt ?? null);
    assertIsoDateTime(data.updatedAt);
    assertStationSummary(data.summary);
    assertStationSync(data.sync);
  });

  await t.test('duplicate station rejection keeps stable error code', async () => {
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

  await t.test('update station keeps wrapper, enum, and nullable-field contract', async () => {
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
    assert.equal(stationStatusValues.includes(data.status), true);
    assertStationSummary(data.summary);
    assertStationSync(data.sync);
  });

  await t.test('nullable station fields are present as null when cleared', async () => {
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

    assert.equal('notes' in data, true);
    assert.equal(data.notes, null);
    assert.equal(data.lastTestDate, null);
    assert.equal(data.customFields?.commissioning_date, '2026-01-15T00:00:00.000Z');
  });

  await t.test('non-required custom fields can be cleared with null', async () => {
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

  await t.test('required custom fields cannot be cleared with null', async () => {
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

  await t.test('required custom fields cannot be cleared with whitespace-only values', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'PUT',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
      payload: {
        customFields: {
          firmware_version: '   ',
        },
      },
    });

    const error = expectError(response, 400, 'CUSTOM_FIELD_REQUIRED');
    assert.equal(error.message, 'Custom field firmware_version is required');
  });

  await t.test('station write endpoints reject unexpected payload properties', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/stations',
        headers: bearerHeaders(token),
        payload: {
          ...buildStationPayload('BAD'),
          unexpected: true,
        },
      }),
      app.inject({
        method: 'PUT',
        url: `/stations/${fixtureIds.stations.existing}`,
        headers: bearerHeaders(token),
        payload: {
          name: 'Unexpected Property Update',
          unexpected: true,
        },
      }),
    ]);

    for (const response of responses) {
      expectError(response, 400, 'VALIDATION_ERROR');
    }
  });

  await t.test('qr lookup returns the lightweight summary contract', async () => {
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
    assertStationSync(data.sync, true);
  });

  await t.test('station detail returns full record, nullable fields, and sync metadata', async () => {
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
    assert.equal(
      data.summary.latestTestResult === null || stationTestResultValues.includes(data.summary.latestTestResult),
      true,
    );
    assertStationSummary(data.summary);
    assertStationSync(data.sync, true);
  });

  await t.test('archive station preserves route path and returns inactive archived state', async () => {
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
    assertStationSync(data.sync, true);
  });

  await t.test('viewer writes and operator admin-only station actions are forbidden', async () => {
    await resetIntegrationDb();

    const { token: viewerToken } = await loginAndGetToken(app, 'viewer');
    const viewerResponses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/stations',
        headers: bearerHeaders(viewerToken),
        payload: buildStationPayload('VIEW'),
      }),
      app.inject({
        method: 'PUT',
        url: `/stations/${fixtureIds.stations.existing}`,
        headers: bearerHeaders(viewerToken),
        payload: {
          name: 'Viewer Update Attempt',
        },
      }),
    ]);

    for (const response of viewerResponses) {
      expectError(response, 403, 'FORBIDDEN');
    }

    const { token: operatorToken } = await loginAndGetToken(app, 'operator');
    const adminOnlyResponses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/stations/${fixtureIds.stations.existing}/archive`,
        headers: bearerHeaders(operatorToken),
      }),
      app.inject({
        method: 'DELETE',
        url: `/stations/${fixtureIds.stations.existing}`,
        headers: bearerHeaders(operatorToken),
      }),
    ]);

    for (const response of adminOnlyResponses) {
      expectError(response, 403, 'FORBIDDEN');
    }
  });
});
