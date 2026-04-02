import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  expectError,
  expectSuccess,
  loginAndGetToken,
  type CustomFieldResponseData,
  type StationResponseData,
} from '../helpers/api-contract';
import {
  bearerHeaders,
  createTestApp,
  fixtureIds,
  resetIntegrationDb,
} from '../helpers/integration';

test('custom fields contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('list custom fields returns wrapped canonical definitions', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'GET',
      url: '/custom-fields',
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<CustomFieldResponseData[]>(response, 200);

    assert.equal(data.length, 3);
    assert.equal(data[0]?.key, 'firmware_version');
    assert.equal(typeof data[1]?.options, 'object');
  });

  await t.test('create, update, and set-active keep the current route contract', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const createResponse = await app.inject({
      method: 'POST',
      url: '/custom-fields',
      headers: bearerHeaders(token),
      payload: {
        key: 'maintenance_window',
        label: 'Maintenance Window',
        type: 'select',
        options: {
          options: ['morning', 'night'],
        },
        isRequired: false,
        isFilterable: true,
        isVisibleInList: false,
        sortOrder: 10,
      },
    });
    const created = expectSuccess<CustomFieldResponseData>(createResponse, 201);

    assert.equal(created.key, 'maintenance_window');
    assert.deepEqual(created.options, {
      options: ['morning', 'night'],
    });

    const updateResponse = await app.inject({
      method: 'PUT',
      url: `/custom-fields/${created.id}`,
      headers: bearerHeaders(token),
      payload: {
        label: 'Maintenance Slot',
        type: 'select',
        options: {
          options: ['day', 'night'],
        },
        isRequired: false,
        isFilterable: true,
        isVisibleInList: true,
        sortOrder: 11,
      },
    });
    const updated = expectSuccess<CustomFieldResponseData>(updateResponse, 200);

    assert.equal(updated.label, 'Maintenance Slot');
    assert.deepEqual(updated.options, {
      options: ['day', 'night'],
    });

    const activeResponse = await app.inject({
      method: 'PATCH',
      url: `/custom-fields/${created.id}/active`,
      headers: bearerHeaders(token),
      payload: {
        isActive: false,
      },
    });
    const inactive = expectSuccess<CustomFieldResponseData>(activeResponse, 200);

    assert.equal(inactive.isActive, false);
  });

  await t.test('select-definition validation uses the normalized custom-field options error code', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'POST',
      url: '/custom-fields',
      headers: bearerHeaders(token),
      payload: {
        key: 'duplicate_options',
        label: 'Duplicate Options',
        type: 'select',
        options: {
          options: ['same', 'same'],
        },
      },
    });

    expectError(response, 400, 'CUSTOM_FIELD_INVALID_OPTIONS');
  });

  await t.test('custom field definition updates reject unsafe type and option changes', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const typeChangeResponse = await app.inject({
      method: 'PUT',
      url: `/custom-fields/${fixtureIds.customFields.firmwareVersion}`,
      headers: bearerHeaders(token),
      payload: {
        label: 'Firmware Version',
        type: 'number',
        options: {},
        isRequired: true,
        isFilterable: true,
        isVisibleInList: true,
        sortOrder: 1,
      },
    });

    expectError(typeChangeResponse, 400, 'CUSTOM_FIELD_TYPE_CHANGE_FORBIDDEN');

    const optionChangeResponse = await app.inject({
      method: 'PUT',
      url: `/custom-fields/${fixtureIds.customFields.coolingType}`,
      headers: bearerHeaders(token),
      payload: {
        label: 'Cooling Type',
        type: 'select',
        options: {
          options: ['liquid'],
        },
        isRequired: true,
        isFilterable: true,
        isVisibleInList: true,
        sortOrder: 2,
      },
    });

    expectError(optionChangeResponse, 400, 'CUSTOM_FIELD_INVALID_OPTIONS');
  });

  await t.test('select-value validation uses the same stable custom-field options error code family', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'PUT',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
      payload: {
        customFields: {
          cooling_type: 'steam',
        },
      },
    });

    const error = expectError(response, 400, 'CUSTOM_FIELD_INVALID_OPTIONS');
    assert.match(error.message, /cooling_type must be one of/i);
  });

  await t.test('custom field write endpoints reject unexpected payload properties', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/custom-fields',
        headers: bearerHeaders(token),
        payload: {
          key: 'unexpected_payload',
          label: 'Unexpected Payload',
          type: 'text',
          unexpected: true,
        },
      }),
      app.inject({
        method: 'PUT',
        url: `/custom-fields/${fixtureIds.customFields.firmwareVersion}`,
        headers: bearerHeaders(token),
        payload: {
          label: 'Firmware Version',
          type: 'text',
          options: {},
          isRequired: true,
          isFilterable: true,
          isVisibleInList: true,
          sortOrder: 1,
          unexpected: true,
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/custom-fields/${fixtureIds.customFields.firmwareVersion}/active`,
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

  await t.test('viewer and operator cannot access admin-only custom field writes', async () => {
    await resetIntegrationDb();

    const { token: viewerToken } = await loginAndGetToken(app, 'viewer');
    const { token: operatorToken } = await loginAndGetToken(app, 'operator');

    const forbiddenResponses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/custom-fields',
        headers: bearerHeaders(viewerToken),
        payload: {
          key: 'viewer_denied',
          label: 'Viewer Denied',
          type: 'text',
        },
      }),
      app.inject({
        method: 'PUT',
        url: `/custom-fields/${fixtureIds.customFields.firmwareVersion}`,
        headers: bearerHeaders(operatorToken),
        payload: {
          label: 'Firmware Version',
          type: 'text',
          options: {},
          isRequired: true,
          isFilterable: true,
          isVisibleInList: true,
          sortOrder: 1,
        },
      }),
      app.inject({
        method: 'PATCH',
        url: `/custom-fields/${fixtureIds.customFields.firmwareVersion}/active`,
        headers: bearerHeaders(operatorToken),
        payload: {
          isActive: false,
        },
      }),
    ]);

    for (const response of forbiddenResponses) {
      expectError(response, 403, 'FORBIDDEN');
    }
  });
});
