import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createIssue,
  createTestHistory,
  expectError,
  expectSuccess,
  loginAndGetToken,
  type DashboardSummaryResponseData,
} from '../helpers/api-contract';
import {
  bearerHeaders,
  createTestApp,
  fixtureIds,
  resetIntegrationDb,
} from '../helpers/integration';

type DashboardRecentStation = {
  id: string;
  name: string;
  code: string;
  status: 'active' | 'maintenance' | 'inactive' | 'faulty';
  isArchived: boolean;
  updatedAt: string;
};

type DashboardRecentIssue = {
  id: string;
  stationId: string;
  stationName: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  createdAt: string;
};

type DashboardRecentTest = {
  id: string;
  stationId: string;
  stationName: string;
  result: 'pass' | 'fail' | 'warning';
  testDate: string;
  createdAt: string;
};

test('dashboard contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('dashboard endpoints remain admin-only', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'GET',
      url: '/dashboard/summary',
      headers: bearerHeaders(token),
    });

    expectError(response, 403, 'FORBIDDEN');
  });

  await t.test('summary and recent dashboard endpoints keep wrapped contracts', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    await createIssue(app, token, fixtureIds.stations.existing, {
      title: 'Dashboard issue',
      severity: 'critical',
    });
    await createTestHistory(app, token, fixtureIds.stations.existing, {
      result: 'pass',
      testDate: '2026-03-30T10:00:00.000Z',
    });

    const summaryResponse = await app.inject({
      method: 'GET',
      url: '/dashboard/summary',
      headers: bearerHeaders(token),
    });
    const summary = expectSuccess<DashboardSummaryResponseData>(summaryResponse, 200);

    assert.equal(summary.totalStations, 1);
    assert.equal(summary.activeStations, 1);
    assert.equal(summary.totalOpenIssues, 1);
    assert.equal(summary.totalCriticalIssues, 1);
    assert.equal(summary.recentTestCount, 1);

    const recentStationsResponse = await app.inject({
      method: 'GET',
      url: '/dashboard/recent-stations?limit=1',
      headers: bearerHeaders(token),
    });
    const recentStations = expectSuccess<DashboardRecentStation[]>(recentStationsResponse, 200);

    assert.equal(recentStations.length, 1);
    assert.equal(recentStations[0]?.id, fixtureIds.stations.existing);

    const recentIssuesResponse = await app.inject({
      method: 'GET',
      url: '/dashboard/recent-issues?limit=1',
      headers: bearerHeaders(token),
    });
    const recentIssues = expectSuccess<DashboardRecentIssue[]>(recentIssuesResponse, 200);

    assert.equal(recentIssues.length, 1);
    assert.equal(recentIssues[0]?.title, 'Dashboard issue');

    const recentTestsResponse = await app.inject({
      method: 'GET',
      url: '/dashboard/recent-tests?limit=1',
      headers: bearerHeaders(token),
    });
    const recentTests = expectSuccess<DashboardRecentTest[]>(recentTestsResponse, 200);

    assert.equal(recentTests.length, 1);
    assert.equal(recentTests[0]?.result, 'pass');
  });
});
