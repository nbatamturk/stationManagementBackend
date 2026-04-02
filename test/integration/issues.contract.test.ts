import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assertIsoDateTime,
  createIssue,
  expectError,
  expectSuccess,
  loginAndGetToken,
  type IssueResponseData,
  type StationResponseData,
} from '../helpers/api-contract';
import {
  bearerHeaders,
  createTestApp,
  fixtureIds,
  resetIntegrationDb,
} from '../helpers/integration';

test('issues contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('create and list station issues', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const created = await createIssue(app, token, fixtureIds.stations.existing, {
      title: 'Cable strain issue',
      description: 'Observed at connector housing.',
      severity: 'high',
    });

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

    const listResponse = await app.inject({
      method: 'GET',
      url: `/stations/${fixtureIds.stations.existing}/issues`,
      headers: bearerHeaders(token),
    });
    const list = expectSuccess<IssueResponseData[]>(listResponse, 200);

    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, created.id);
    assert.equal(list[0]?.status, 'open');

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

  await t.test('update issue status and nullable fields', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const created = await createIssue(app, token, fixtureIds.stations.existing, {
      title: 'Door latch issue',
      severity: 'medium',
    });

    const response = await app.inject({
      method: 'PATCH',
      url: `/issues/${created.id}`,
      headers: bearerHeaders(token),
      payload: {
        description: null,
        assignedTo: fixtureIds.users.admin,
        status: 'resolved',
      },
    });
    const updated = expectSuccess<IssueResponseData>(response, 200);

    assert.equal(updated.description, null);
    assert.equal(updated.assignedTo, fixtureIds.users.admin);
    assert.equal(updated.status, 'resolved');
    assertIsoDateTime(updated.resolvedAt);
  });

  await t.test('issue write endpoints reject unexpected payload properties', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const created = await createIssue(app, token, fixtureIds.stations.existing, {
      title: 'Unexpected Payload Issue',
      severity: 'medium',
    });

    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/stations/${fixtureIds.stations.existing}/issues`,
        headers: bearerHeaders(token),
        payload: {
          title: 'Write Rejection',
          unexpected: true,
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/issues/${created.id}`,
        headers: bearerHeaders(token),
        payload: {
          status: 'resolved',
          unexpected: true,
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/issues/${created.id}/status`,
        headers: bearerHeaders(token),
        payload: {
          status: 'closed',
          unexpected: true,
        },
      }),
    ]);

    for (const response of responses) {
      expectError(response, 400, 'VALIDATION_ERROR');
    }
  });

  await t.test('delete issue returns wrapped delete contract and updates station summary', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const created = await createIssue(app, token, fixtureIds.stations.existing, {
      title: 'Temporary fault',
      severity: 'critical',
    });

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/issues/${created.id}`,
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

    assert.equal(station.summary.totalIssueCount, 0);
    assert.equal(station.summary.openIssueCount, 0);
    assert.equal(station.summary.hasOpenIssues, false);
  });

  await t.test('viewer cannot create, update, change status, or delete issues', async () => {
    await resetIntegrationDb();

    const { token: operatorToken } = await loginAndGetToken(app, 'operator');
    const created = await createIssue(app, operatorToken, fixtureIds.stations.existing, {
      title: 'Viewer Denied Issue',
      severity: 'medium',
    });

    const { token: viewerToken } = await loginAndGetToken(app, 'viewer');
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/stations/${fixtureIds.stations.existing}/issues`,
        headers: bearerHeaders(viewerToken),
        payload: {
          title: 'Viewer Create Attempt',
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/issues/${created.id}`,
        headers: bearerHeaders(viewerToken),
        payload: {
          status: 'resolved',
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/issues/${created.id}/status`,
        headers: bearerHeaders(viewerToken),
        payload: {
          status: 'closed',
        },
      }),
      app.inject({
        method: 'DELETE',
        url: `/issues/${created.id}`,
        headers: bearerHeaders(viewerToken),
      }),
    ]);

    for (const response of responses) {
      expectError(response, 403, 'FORBIDDEN');
    }
  });
});
