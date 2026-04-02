import assert from 'node:assert/strict';
import { test } from 'node:test';

import { env } from '../../src/config/env';
import {
  assertIsoDateTime,
  assertJsonResponse,
  expectError,
  expectSuccess,
  loginAndGetToken,
  parseBody,
  type LoginResponseData,
} from '../helpers/api-contract';
import {
  createTestApp,
  loginAs,
  resetIntegrationDb,
  testCredentials,
} from '../helpers/integration';

test('system and auth contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('health remains a raw non-wrapper JSON contract', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(response.statusCode, 200);
    assertJsonResponse(response);

    const body = parseBody<{ status: 'ok'; timestamp: string }>(response);
    assert.deepEqual(Object.keys(body).sort(), ['status', 'timestamp']);
    assert.equal(body.status, 'ok');
    assertIsoDateTime(body.timestamp);
  });

  await t.test('login success returns wrapped session payload', async () => {
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

  await t.test('login failure and rate limiting use stable error codes', async () => {
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

  await t.test('current user endpoint returns the authenticated user contract', async () => {
    await resetIntegrationDb();

    const { token, user } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });
    const data = expectSuccess<{ user: LoginResponseData['user'] }>(response, 200);

    assert.deepEqual(data.user, user);
  });

  await t.test('protected auth route rejects missing credentials', async () => {
    await resetIntegrationDb();

    const response = await app.inject({
      method: 'GET',
      url: '/auth/me',
    });

    expectError(response, 401, 'UNAUTHORIZED');
  });
});
