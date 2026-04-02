import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createStation,
  expectError,
  expectPaginated,
  loginAndGetToken,
  type AuditLogResponseData,
} from '../helpers/api-contract';
import {
  bearerHeaders,
  createTestApp,
  resetIntegrationDb,
} from '../helpers/integration';

test('audit logs contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('audit logs are admin-only', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'GET',
      url: '/audit-logs',
      headers: bearerHeaders(token),
    });

    expectError(response, 403, 'FORBIDDEN');
  });

  await t.test('audit log listing uses paginated contract and supports filters', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    await createStation(app, token, 'AUD');

    const response = await app.inject({
      method: 'GET',
      url: '/audit-logs?action=station.created&limit=5',
      headers: bearerHeaders(token),
    });
    const body = expectPaginated<AuditLogResponseData>(response, 200);

    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 5);
    assert.ok(body.meta.total >= 1);
    assert.ok(body.data.every((entry) => entry.action === 'station.created'));
    assert.ok(body.data.every((entry) => typeof entry.metadata === 'object'));
  });

  await t.test('audit log filters reject inverted date ranges with stable error code', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'GET',
      url: '/audit-logs?createdFrom=2026-04-02T00:00:00.000Z&createdTo=2026-04-01T00:00:00.000Z',
      headers: bearerHeaders(token),
    });

    expectError(response, 400, 'INVALID_FILTER');
  });
});
