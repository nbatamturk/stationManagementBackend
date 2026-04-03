import assert from 'node:assert/strict';
import { test } from 'node:test';

import { usersService } from '../../src/modules/users/users.service';
import {
  expectError,
  expectPaginated,
  expectSuccess,
  loginAndGetToken,
  type LoginResponseData,
  type UserResponseData,
} from '../helpers/api-contract';
import {
  bearerHeaders,
  createTestApp,
  fixtureIds,
  resetIntegrationDb,
  testCredentials,
} from '../helpers/integration';

test('users contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('list users uses paginated wrapper and stable safe-user fields', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'GET',
      url: '/users?limit=2&search=integration',
      headers: bearerHeaders(token),
    });
    const body = expectPaginated<UserResponseData>(response, 200);

    assert.equal(body.meta.page, 1);
    assert.equal(body.meta.limit, 2);
    assert.equal(body.meta.total, 4);
    assert.equal(body.data.length, 2);
    assert.equal('passwordHash' in body.data[0]!, false);
  });

  await t.test('get user by id returns the safe user contract', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'GET',
      url: `/users/${fixtureIds.users.operator}`,
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<UserResponseData>(response, 200);

    assert.equal(data.id, fixtureIds.users.operator);
    assert.equal(data.email, testCredentials.operator.email);
    assert.equal(data.role, 'operator');
    assert.equal(data.isActive, true);
  });

  await t.test('create and update user preserve the frozen wrapper contract', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const createResponse = await app.inject({
      method: 'POST',
      url: '/users',
      headers: bearerHeaders(token),
      payload: {
        email: 'new.user.integration@evlab.local',
        fullName: 'New Integration User',
        password: 'NewUser123!',
        role: 'viewer',
        isActive: true,
      },
    });
    const created = expectSuccess<UserResponseData>(createResponse, 201);

    assert.equal(created.email, 'new.user.integration@evlab.local');
    assert.equal(created.role, 'viewer');
    assert.equal(created.isActive, true);

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/users/${created.id}`,
      headers: bearerHeaders(token),
      payload: {
        fullName: 'Updated Integration User',
        role: 'operator',
      },
    });
    const updated = expectSuccess<UserResponseData>(updateResponse, 200);

    assert.equal(updated.fullName, 'Updated Integration User');
    assert.equal(updated.role, 'operator');
  });

  await t.test('set active toggles user state through the frozen route path', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const createResponse = await app.inject({
      method: 'POST',
      url: '/users',
      headers: bearerHeaders(token),
      payload: {
        email: 'toggle.integration@evlab.local',
        fullName: 'Toggle Integration User',
        password: 'Toggle123!',
        role: 'operator',
      },
    });
    const created = expectSuccess<UserResponseData>(createResponse, 201);

    const deactivateResponse = await app.inject({
      method: 'PATCH',
      url: `/users/${created.id}/active`,
      headers: bearerHeaders(token),
      payload: {
        isActive: false,
      },
    });
    const deactivated = expectSuccess<UserResponseData>(deactivateResponse, 200);
    assert.equal(deactivated.isActive, false);

    const reactivateResponse = await app.inject({
      method: 'PATCH',
      url: `/users/${created.id}/active`,
      headers: bearerHeaders(token),
      payload: {
        isActive: true,
      },
    });
    const reactivated = expectSuccess<UserResponseData>(reactivateResponse, 200);
    assert.equal(reactivated.isActive, true);
  });

  await t.test('delete user removes the account while preserving self-delete and last-admin guards', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const createResponse = await app.inject({
      method: 'POST',
      url: '/users',
      headers: bearerHeaders(token),
      payload: {
        email: 'delete.integration@evlab.local',
        fullName: 'Delete Integration User',
        password: 'Delete123!',
        role: 'viewer',
      },
    });
    const created = expectSuccess<UserResponseData>(createResponse, 201);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/users/${created.id}`,
      headers: bearerHeaders(token),
    });
    const deleted = expectSuccess<{ success: true; id: string }>(deleteResponse, 200);

    assert.equal(deleted.success, true);
    assert.equal(deleted.id, created.id);

    expectError(
      await app.inject({
        method: 'DELETE',
        url: `/users/${fixtureIds.users.admin}`,
        headers: bearerHeaders(token),
      }),
      400,
      'CANNOT_DELETE_SELF',
    );
  });

  await t.test('user write endpoints reject unexpected payload properties', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/users',
        headers: bearerHeaders(token),
        payload: {
          email: 'unexpected.create@evlab.local',
          fullName: 'Unexpected Create',
          password: 'Unexpected123!',
          unexpected: true,
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/users/${fixtureIds.users.operator}`,
        headers: bearerHeaders(token),
        payload: {
          fullName: 'Unexpected Update',
          unexpected: true,
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/users/${fixtureIds.users.operator}/active`,
        headers: bearerHeaders(token),
        payload: {
          isActive: false,
          unexpected: true,
        },
      }),
    ]);

    for (const response of responses) {
      expectError(response, 400, 'VALIDATION_ERROR');
    }
  });

  await t.test('self-deactivation stays blocked with a stable error code', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'PATCH',
      url: `/users/${fixtureIds.users.admin}/active`,
      headers: bearerHeaders(token),
      payload: {
        isActive: false,
      },
    });

    expectError(response, 400, 'CANNOT_DEACTIVATE_SELF');
  });

  await t.test('last-admin guard remains enforced at the service layer', async () => {
    await resetIntegrationDb();

    await assert.rejects(
      () => usersService.setActive(fixtureIds.users.operator, fixtureIds.users.admin, false),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'LAST_ADMIN_REQUIRED',
    );
  });

  await t.test('duplicate email rejection keeps the established conflict code', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'POST',
      url: '/users',
      headers: bearerHeaders(token),
      payload: {
        email: testCredentials.operator.email,
        fullName: 'Duplicate Email User',
        password: 'Duplicate123!',
        role: 'operator',
      },
    });

    expectError(response, 409, 'USER_EMAIL_EXISTS');
  });

  await t.test('admin user password resets invalidate the old password and accept the new password', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const newPassword = 'OperatorReset123!';

    const response = await app.inject({
      method: 'PATCH',
      url: `/users/${fixtureIds.users.operator}`,
      headers: bearerHeaders(token),
      payload: {
        password: newPassword,
      },
    });

    expectSuccess<UserResponseData>(response, 200);

    const oldLoginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: testCredentials.operator.email,
        password: testCredentials.operator.password,
      },
    });

    expectError(oldLoginResponse, 401, 'INVALID_CREDENTIALS');

    const newLoginResponse = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: {
        email: testCredentials.operator.email,
        password: newPassword,
      },
    });

    expectSuccess<LoginResponseData>(newLoginResponse, 200);
  });

  await t.test('user management rejects whitespace-only passwords and full-name updates', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/users',
        headers: bearerHeaders(token),
        payload: {
          email: 'blank.password@evlab.local',
          fullName: 'Blank Password',
          password: '        ',
          role: 'operator',
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/users/${fixtureIds.users.operator}`,
        headers: bearerHeaders(token),
        payload: {
          password: '        ',
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/users/${fixtureIds.users.operator}`,
        headers: bearerHeaders(token),
        payload: {
          fullName: '   ',
        },
      }),
    ]);

    for (const response of responses) {
      expectError(response, 400, 'INVALID_INPUT');
    }
  });

  await t.test('viewer and operator cannot perform admin-only user writes', async () => {
    await resetIntegrationDb();

    const { token: viewerToken } = await loginAndGetToken(app, 'viewer');
    const { token: operatorToken } = await loginAndGetToken(app, 'operator');

    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/users',
        headers: bearerHeaders(viewerToken),
        payload: {
          email: 'viewer.denied@evlab.local',
          fullName: 'Viewer Denied',
          password: 'ViewerDenied123!',
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/users/${fixtureIds.users.viewer}`,
        headers: bearerHeaders(operatorToken),
        payload: {
          role: 'operator',
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/users/${fixtureIds.users.viewer}/active`,
        headers: bearerHeaders(operatorToken),
        payload: {
          isActive: false,
        },
      }),
      app.inject({
        method: 'DELETE',
        url: `/users/${fixtureIds.users.viewer}`,
        headers: bearerHeaders(operatorToken),
      }),
    ]);

    for (const response of responses) {
      expectError(response, 403, 'FORBIDDEN');
    }
  });
});
