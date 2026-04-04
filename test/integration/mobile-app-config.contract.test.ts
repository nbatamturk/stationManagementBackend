import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  assertIsoDateTime,
  expectError,
  expectSuccess,
  loginAndGetToken,
} from '../helpers/api-contract';
import { bearerHeaders, createTestApp, fixtureIds, resetIntegrationDb } from '../helpers/integration';

type MobileAppConfigResponseData = {
  iosMinimumSupportedVersion: string | null;
  androidMinimumSupportedVersion: string | null;
  iosDownloadUrl: string | null;
  androidDownloadUrl: string | null;
  updatedAt: string | null;
  updatedByUserId: string | null;
};

type MobileAppVersionCheckResponseData = {
  platform: 'ios' | 'android';
  appVersion: string;
  minimumSupportedVersion: string | null;
  downloadUrl: string | null;
  shouldWarn: boolean;
  warningMode: 'warn';
  message: string | null;
};

test('mobile app config contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('admin get returns the empty singleton config when no policy is set', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'GET',
      url: '/mobile-app-config',
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<MobileAppConfigResponseData>(response, 200);

    assert.deepEqual(data, {
      iosMinimumSupportedVersion: null,
      androidMinimumSupportedVersion: null,
      iosDownloadUrl: null,
      androidDownloadUrl: null,
      updatedAt: null,
      updatedByUserId: null,
    });
  });

  await t.test('admin put persists the singleton config and get returns the updated values', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const updateResponse = await app.inject({
      method: 'PUT',
      url: '/mobile-app-config',
      headers: bearerHeaders(token),
      payload: {
        iosMinimumSupportedVersion: '1.2.3',
        androidMinimumSupportedVersion: '2.3.4',
        iosDownloadUrl: 'https://apps.apple.com/app/example-ios',
        androidDownloadUrl: 'https://play.google.com/store/apps/details?id=example.android',
      },
    });
    const updated = expectSuccess<MobileAppConfigResponseData>(updateResponse, 200);

    assert.equal(updated.iosMinimumSupportedVersion, '1.2.3');
    assert.equal(updated.androidMinimumSupportedVersion, '2.3.4');
    assert.equal(updated.iosDownloadUrl, 'https://apps.apple.com/app/example-ios');
    assert.equal(
      updated.androidDownloadUrl,
      'https://play.google.com/store/apps/details?id=example.android',
    );
    assert.equal(updated.updatedByUserId, fixtureIds.users.admin);
    assertIsoDateTime(updated.updatedAt);

    const getResponse = await app.inject({
      method: 'GET',
      url: '/mobile-app-config',
      headers: bearerHeaders(token),
    });
    const fetched = expectSuccess<MobileAppConfigResponseData>(getResponse, 200);

    assert.equal(fetched.iosMinimumSupportedVersion, '1.2.3');
    assert.equal(fetched.androidMinimumSupportedVersion, '2.3.4');
    assert.equal(fetched.iosDownloadUrl, 'https://apps.apple.com/app/example-ios');
    assert.equal(
      fetched.androidDownloadUrl,
      'https://play.google.com/store/apps/details?id=example.android',
    );
    assert.equal(fetched.updatedByUserId, fixtureIds.users.admin);
    assertIsoDateTime(fetched.updatedAt);
  });

  await t.test('admin write access stays restricted to admins', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'PUT',
      url: '/mobile-app-config',
      headers: bearerHeaders(token),
      payload: {
        iosMinimumSupportedVersion: '1.2.3',
        androidMinimumSupportedVersion: null,
        iosDownloadUrl: null,
        androidDownloadUrl: null,
      },
    });

    expectError(response, 403, 'FORBIDDEN');
  });

  await t.test('public check works without auth and does not warn when no minimum version exists', async () => {
    await resetIntegrationDb();

    const response = await app.inject({
      method: 'POST',
      url: '/mobile-app-config/check',
      payload: {
        platform: 'ios',
        appVersion: '1.0.0',
      },
    });
    const data = expectSuccess<MobileAppVersionCheckResponseData>(response, 200);

    assert.equal(data.platform, 'ios');
    assert.equal(data.appVersion, '1.0.0');
    assert.equal(data.minimumSupportedVersion, null);
    assert.equal(data.downloadUrl, null);
    assert.equal(data.shouldWarn, false);
    assert.equal(data.warningMode, 'warn');
    assert.equal(data.message, null);
  });

  await t.test('platform download URLs do not trigger warnings on their own but are returned by the public check endpoint', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    expectSuccess<MobileAppConfigResponseData>(
      await app.inject({
        method: 'PUT',
        url: '/mobile-app-config',
        headers: bearerHeaders(token),
        payload: {
          iosMinimumSupportedVersion: null,
          androidMinimumSupportedVersion: null,
          iosDownloadUrl: 'https://apps.apple.com/app/example-ios',
          androidDownloadUrl: 'https://play.google.com/store/apps/details?id=example.android',
        },
      }),
      200,
    );

    const response = await app.inject({
      method: 'POST',
      url: '/mobile-app-config/check',
      payload: {
        platform: 'android',
        appVersion: '1.0.0',
      },
    });
    const data = expectSuccess<MobileAppVersionCheckResponseData>(response, 200);

    assert.equal(data.minimumSupportedVersion, null);
    assert.equal(data.downloadUrl, 'https://play.google.com/store/apps/details?id=example.android');
    assert.equal(data.shouldWarn, false);
    assert.equal(data.message, null);
  });

  await t.test('public check warns only when the installed version is below the configured minimum', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    expectSuccess<MobileAppConfigResponseData>(
      await app.inject({
        method: 'PUT',
        url: '/mobile-app-config',
        headers: bearerHeaders(token),
        payload: {
          iosMinimumSupportedVersion: '1.2.3',
          androidMinimumSupportedVersion: '2.0.0',
          iosDownloadUrl: 'https://apps.apple.com/app/example-ios',
          androidDownloadUrl: 'https://play.google.com/store/apps/details?id=example.android',
        },
      }),
      200,
    );

    const belowMinimum = expectSuccess<MobileAppVersionCheckResponseData>(
      await app.inject({
        method: 'POST',
        url: '/mobile-app-config/check',
        payload: {
          platform: 'android',
          appVersion: '1.9.9',
        },
      }),
      200,
    );

    assert.equal(belowMinimum.minimumSupportedVersion, '2.0.0');
    assert.equal(
      belowMinimum.downloadUrl,
      'https://play.google.com/store/apps/details?id=example.android',
    );
    assert.equal(belowMinimum.shouldWarn, true);
    assert.match(belowMinimum.message ?? '', /below the minimum supported version/i);

    const equalVersion = expectSuccess<MobileAppVersionCheckResponseData>(
      await app.inject({
        method: 'POST',
        url: '/mobile-app-config/check',
        payload: {
          platform: 'ios',
          appVersion: '1.2.3',
        },
      }),
      200,
    );

    assert.equal(equalVersion.shouldWarn, false);
    assert.equal(equalVersion.downloadUrl, 'https://apps.apple.com/app/example-ios');
    assert.equal(equalVersion.message, null);

    const aboveMinimum = expectSuccess<MobileAppVersionCheckResponseData>(
      await app.inject({
        method: 'POST',
        url: '/mobile-app-config/check',
        payload: {
          platform: 'android',
          appVersion: '2.0.1',
        },
      }),
      200,
    );

    assert.equal(aboveMinimum.shouldWarn, false);
    assert.equal(
      aboveMinimum.downloadUrl,
      'https://play.google.com/store/apps/details?id=example.android',
    );
    assert.equal(aboveMinimum.message, null);
  });

  await t.test('invalid platform, invalid version format, and invalid download URLs are rejected with 400 responses', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');

    expectError(
      await app.inject({
        method: 'POST',
        url: '/mobile-app-config/check',
        payload: {
          platform: 'web',
          appVersion: '1.0.0',
        },
      }),
      400,
      'VALIDATION_ERROR',
    );

    expectError(
      await app.inject({
        method: 'POST',
        url: '/mobile-app-config/check',
        payload: {
          platform: 'ios',
          appVersion: '1.0',
        },
      }),
      400,
      'VALIDATION_ERROR',
    );

    expectError(
      await app.inject({
        method: 'PUT',
        url: '/mobile-app-config',
        headers: bearerHeaders(token),
        payload: {
          iosMinimumSupportedVersion: '1.0',
          androidMinimumSupportedVersion: null,
          iosDownloadUrl: null,
          androidDownloadUrl: null,
        },
      }),
      400,
      'VALIDATION_ERROR',
    );

    expectError(
      await app.inject({
        method: 'PUT',
        url: '/mobile-app-config',
        headers: bearerHeaders(token),
        payload: {
          iosMinimumSupportedVersion: null,
          androidMinimumSupportedVersion: null,
          iosDownloadUrl: 'http://apps.apple.com/app/example-ios',
          androidDownloadUrl: null,
        },
      }),
      400,
      'INVALID_APP_DOWNLOAD_URL',
    );

    expectError(
      await app.inject({
        method: 'PUT',
        url: '/mobile-app-config',
        headers: bearerHeaders(token),
        payload: {
          iosMinimumSupportedVersion: null,
          androidMinimumSupportedVersion: null,
          iosDownloadUrl: 'not-a-url',
          androidDownloadUrl: null,
        },
      }),
      400,
      'INVALID_APP_DOWNLOAD_URL',
    );
  });
});
