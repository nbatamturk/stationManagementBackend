import assert from 'node:assert/strict';
import { test } from 'node:test';

import { eq } from 'drizzle-orm';

import { db } from '../../src/db/client';
import {
  currentTypeValues,
  socketTypeValues,
  stationStatusValues,
  stationTestResultValues,
} from '../../src/contracts/domain';
import { stationConnectors, stationModels } from '../../src/db/schema';
import {
  assertStationConnectorSummary,
  assertIsoDateTime,
  assertStationSummary,
  assertStationSync,
  authHeaders,
  buildMultipartUpload,
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

const tinyPngImage = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9W3nQAAAAASUVORK5CYII=',
  'base64',
);

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
    assertStationConnectorSummary(body.data[0]!.connectorSummary);
    assertStationSummary(body.data[0]!.summary);
    assertStationSync(body.data[0]!.sync);
  });

  await t.test('station config returns catalog items and latest template snapshots', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'GET',
      url: '/stations/config',
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<{
      statuses: string[];
      currentTypes: string[];
      connectorTypes: string[];
      brands: Array<{ id: string; name: string; isActive: boolean; createdAt: string; updatedAt: string }>;
      models: Array<{
        id: string;
        brandId: string;
        name: string;
        description: string | null;
        imageUrl: string | null;
        logoUrl: string | null;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
        latestTemplateVersion: number | null;
        latestTemplateConnectors: Array<{
          connectorNo: number;
          connectorType: string;
          currentType: string;
          powerKw: number;
          isActive?: boolean;
          sortOrder?: number;
        }>;
      }>;
    }>(response, 200);

    assert.deepEqual(data.statuses, stationStatusValues);
    assert.deepEqual(data.currentTypes, currentTypeValues);
    assert.deepEqual(data.connectorTypes, socketTypeValues);
    assert.equal(data.brands.length >= 2, true);
    assert.equal(data.models.length >= 2, true);

    const abb = data.brands.find((brand) => brand.id === fixtureIds.brands.abb);
    const terra54 = data.models.find((model) => model.id === fixtureIds.models.terra54);
    const sichargeD = data.models.find((model) => model.id === fixtureIds.models.sichargeD);

    assert.equal(abb?.name, 'ABB');
    assert.equal(abb?.isActive, true);
    assert.equal(terra54?.brandId, fixtureIds.brands.abb);
    assert.equal(terra54?.latestTemplateVersion, 2);
    assert.equal(terra54?.latestTemplateConnectors.length, 2);
    assert.deepEqual(
      terra54?.latestTemplateConnectors.map((connector) => [connector.connectorNo, connector.connectorType]),
      [
        [1, 'Type2'],
        [2, 'CCS2'],
      ],
    );
    assert.equal(sichargeD?.latestTemplateVersion, null);
    assert.deepEqual(sichargeD?.latestTemplateConnectors ?? [], []);
  });

  await t.test('station config falls back to legacy imageUrl when no stored backend image exists', async () => {
    await resetIntegrationDb();

    await db
      .update(stationModels)
      .set({
        imageUrl: 'https://legacy.example/terra54.png',
        logoUrl: 'https://legacy.example/terra54-logo.png',
      })
      .where(eq(stationModels.id, fixtureIds.models.terra54));

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'GET',
      url: '/stations/config',
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<{ models: Array<{ id: string; imageUrl: string | null; logoUrl: string | null }> }>(
      response,
      200,
    );

    const terra54 = data.models.find((model) => model.id === fixtureIds.models.terra54);
    assert.equal(terra54?.imageUrl, 'https://legacy.example/terra54.png');
    assert.equal(terra54?.logoUrl, null);
  });

  await t.test('station model image upload, download, and delete use the secure backend-managed media flow', async () => {
    await resetIntegrationDb();

    const { token: adminToken } = await loginAndGetToken(app, 'admin');
    const { token: operatorToken } = await loginAndGetToken(app, 'operator');
    const upload = buildMultipartUpload({
      content: tinyPngImage,
      contentType: 'image/png',
      fileName: 'terra54.png',
    });

    const forbiddenUpload = await app.inject({
      method: 'PUT',
      url: `/stations/models/${fixtureIds.models.terra54}/image`,
      headers: authHeaders(operatorToken, upload.headers),
      payload: upload.payload,
    });
    expectError(forbiddenUpload, 403, 'FORBIDDEN');

    const uploadResponse = await app.inject({
      method: 'PUT',
      url: `/stations/models/${fixtureIds.models.terra54}/image`,
      headers: authHeaders(adminToken, upload.headers),
      payload: upload.payload,
    });
    const uploadData = expectSuccess<{ imageUrl: string | null; logoUrl: string | null }>(uploadResponse, 200);

    assert.match(uploadData.imageUrl ?? '', new RegExp(`^/stations/models/${fixtureIds.models.terra54}/image\\?v=`));
    assert.equal(uploadData.logoUrl, null);

    const storedModel = await db.query.stationModels.findFirst({
      where: eq(stationModels.id, fixtureIds.models.terra54),
    });

    assert.ok(storedModel?.imageStoragePath);
    assert.ok(storedModel?.imageMimeType);
    assert.ok(storedModel?.imageOriginalFileName);
    assert.ok(typeof storedModel?.imageSizeBytes === 'number' && storedModel.imageSizeBytes > 0);

    const anonymousDownload = await app.inject({
      method: 'GET',
      url: `/stations/models/${fixtureIds.models.terra54}/image`,
    });
    expectError(anonymousDownload, 401, 'UNAUTHORIZED');

    const downloadResponse = await app.inject({
      method: 'GET',
      url: `/stations/models/${fixtureIds.models.terra54}/image`,
      headers: bearerHeaders(operatorToken),
    });

    assert.equal(downloadResponse.statusCode, 200);
    assert.match(String(downloadResponse.headers['content-type']), /^image\/(jpeg|png)$/i);
    assert.match(String(downloadResponse.headers['content-disposition']), /^inline;/i);
    assert.equal(String(downloadResponse.headers['cache-control']), 'private, max-age=300');
    assert.equal(String(downloadResponse.headers['x-content-type-options']), 'nosniff');
    assert.ok(Buffer.byteLength(downloadResponse.body) > 0);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/stations/models/${fixtureIds.models.terra54}/image`,
      headers: bearerHeaders(adminToken),
    });
    expectSuccess<{ success: true; id: string }>(deleteResponse, 200);

    const clearedModel = await db.query.stationModels.findFirst({
      where: eq(stationModels.id, fixtureIds.models.terra54),
    });

    assert.equal(clearedModel?.imageStoragePath ?? null, null);
    assert.equal(clearedModel?.imageMimeType ?? null, null);
    assert.equal(clearedModel?.imageOriginalFileName ?? null, null);
    assert.equal(clearedModel?.imageSizeBytes ?? null, null);
    assert.equal(clearedModel?.imageUpdatedAt ?? null, null);
  });

  await t.test('station model image upload rejects invalid image content', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const invalidUpload = buildMultipartUpload({
      content: Buffer.from('not-a-real-image', 'utf-8'),
      contentType: 'image/png',
      fileName: 'broken.png',
    });

    const response = await app.inject({
      method: 'PUT',
      url: `/stations/models/${fixtureIds.models.terra54}/image`,
      headers: authHeaders(token, invalidUpload.headers),
      payload: invalidUpload.payload,
    });

    expectError(response, 415, 'INVALID_STATION_MODEL_IMAGE_CONTENT');
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
    assert.equal(data.brand, payload.brand);
    assert.equal(data.model, payload.model);
    assert.equal(data.powerKw, payload.connectors[0]!.powerKw);
    assert.equal(data.notes, payload.notes);
    assert.equal(data.customFields?.firmware_version, payload.customFields.firmware_version);
    assert.equal(data.customFields?.cooling_type, payload.customFields.cooling_type);
    assert.equal(currentTypeValues.includes(data.currentType), true);
    assert.equal(data.brandId.length > 0, true);
    assert.equal(data.modelId.length > 0, true);
    assert.equal(data.modelTemplateVersion, null);
    assert.deepEqual(data.connectorSummary.types, ['CCS2']);
    assert.equal(data.connectorSummary.maxPowerKw, payload.connectors[0]!.powerKw);
    assert.equal(data.connectorSummary.hasAC, false);
    assert.equal(data.connectorSummary.hasDC, true);
    assert.equal(data.connectorSummary.count, 1);
    assert.equal(Array.isArray(data.connectors), true);
    assert.equal(data.connectors?.length, 1);
    assert.equal(data.connectors?.[0]?.connectorNo, 1);
    assert.equal(data.connectors?.[0]?.connectorType, 'CCS2');
    assert.equal(typeof data.socketType, 'string');
    assert.equal(socketTypeValues.includes(data.connectorSummary.types[0]!), true);
    assert.equal(stationStatusValues.includes(data.status), true);
    assert.equal(data.isArchived, false);
    assertIsoDateTime(data.createdAt ?? null);
    assertIsoDateTime(data.updatedAt);
    assertStationConnectorSummary(data.connectorSummary);
    assertStationSummary(data.summary);
    assertStationSync(data.sync, true);
  });

  await t.test('create station accepts brandId and modelId as the primary catalog contract', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const payload = buildStationPayload('CID');
    const response = await app.inject({
      method: 'POST',
      url: '/stations',
      headers: bearerHeaders(token),
      payload: {
        ...payload,
        brandId: fixtureIds.brands.siemens,
        modelId: fixtureIds.models.sichargeD,
        brand: undefined,
        model: undefined,
      },
    });
    const data = expectSuccess<StationResponseData>(response, 201);

    assert.equal(data.brandId, fixtureIds.brands.siemens);
    assert.equal(data.modelId, fixtureIds.models.sichargeD);
    assert.equal(data.brand, 'Siemens');
    assert.equal(data.model, 'Sicharge D');
    assert.equal(data.code, payload.code);
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

  await t.test('station write rejects a modelId that does not belong to the selected brandId', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const payload = buildStationPayload('MIS');
    const response = await app.inject({
      method: 'POST',
      url: '/stations',
      headers: bearerHeaders(token),
      payload: {
        ...payload,
        brandId: fixtureIds.brands.abb,
        modelId: fixtureIds.models.sichargeD,
        brand: undefined,
        model: undefined,
      },
    });

    const error = expectError(response, 400, 'STATION_MODEL_BRAND_MISMATCH');
    assert.match(error.message, /does not belong to the selected brand/i);
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
        connectors: [
          {
            connectorNo: 1,
            connectorType: 'CCS2',
            currentType: 'DC',
            powerKw: 75.5,
          },
        ],
        notes: 'Updated in integration test',
      },
    });
    const data = expectSuccess<StationResponseData>(response, 200);

    assert.equal(data.name, 'Updated Integration Station');
    assert.equal(data.status, 'maintenance');
    assert.equal(data.powerKw, 75.5);
    assert.equal(data.connectorSummary.maxPowerKw, 75.5);
    assert.equal(data.notes, 'Updated in integration test');
    assert.equal(data.customFields?.firmware_version, 'v1.0.0');
    assert.equal(stationStatusValues.includes(data.status), true);
    assertStationConnectorSummary(data.connectorSummary);
    assertStationSummary(data.summary);
    assertStationSync(data.sync, true);
  });

  await t.test('connector replacement soft-deletes old rows and returns ordered connector summary', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'PUT',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
      payload: {
        connectors: [
          {
            connectorNo: 2,
            connectorType: 'CCS2',
            currentType: 'DC',
            powerKw: 50,
            sortOrder: 2,
          },
          {
            connectorNo: 1,
            connectorType: 'Type2',
            currentType: 'AC',
            powerKw: 22,
            sortOrder: 1,
          },
        ],
      },
    });
    const data = expectSuccess<StationResponseData>(response, 200);

    assert.equal(data.powerKw, 50);
    assert.equal(data.currentType, 'DC');
    assert.equal(data.socketType, 'Type2, CCS2');
    assert.deepEqual(
      data.connectors?.map((connector) => [connector.connectorNo, connector.connectorType]),
      [
        [1, 'Type2'],
        [2, 'CCS2'],
      ],
    );
    assert.deepEqual(data.connectorSummary.types, ['Type2', 'CCS2']);
    assert.equal(data.connectorSummary.hasAC, true);
    assert.equal(data.connectorSummary.hasDC, true);
    assert.equal(data.connectorSummary.count, 2);

    const connectorRows = await db
      .select()
      .from(stationConnectors)
      .where(eq(stationConnectors.stationId, fixtureIds.stations.existing));

    assert.equal(connectorRows.length, 3);
    assert.equal(
      connectorRows.filter((connector) => connector.isDeleted === false).length,
      2,
    );
    const softDeletedConnector = connectorRows.find((connector) => connector.id === fixtureIds.connectors.existingLive);
    assert.equal(softDeletedConnector?.isDeleted, true);
    assert.ok(softDeletedConnector?.deletedAt instanceof Date);
  });

  await t.test('apply model template replaces live connectors and stores the template version', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/apply-model-template`,
      headers: bearerHeaders(token),
    });
    const data = expectSuccess<StationResponseData>(response, 200);

    assert.equal(data.modelTemplateVersion, 2);
    assert.equal(data.powerKw, 50);
    assert.equal(data.currentType, 'DC');
    assert.equal(data.socketType, 'Type2, CCS2');
    assert.deepEqual(data.connectorSummary.types, ['Type2', 'CCS2']);
    assert.equal(data.connectorSummary.count, 2);
    assert.deepEqual(
      data.connectors?.map((connector) => [connector.connectorNo, connector.connectorType, connector.sortOrder]),
      [
        [1, 'Type2', 1],
        [2, 'CCS2', 2],
      ],
    );

    const liveConnectors = await db
      .select()
      .from(stationConnectors)
      .where(eq(stationConnectors.stationId, fixtureIds.stations.existing));

    assert.equal(liveConnectors.filter((connector) => connector.isDeleted === false).length, 2);
    assert.equal(
      liveConnectors.some((connector) => connector.id === fixtureIds.connectors.existingLive && connector.isDeleted === true),
      true,
    );
  });

  await t.test('admin catalog mutations update station config data', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');

    const createdBrand = expectSuccess<{ id: string; name: string; isActive: boolean }>(
      await app.inject({
        method: 'POST',
        url: '/stations/brands',
        headers: bearerHeaders(token),
        payload: {
          name: 'Alpitronic',
        },
      }),
      201,
    );

    const updatedBrand = expectSuccess<{ id: string; name: string; isActive: boolean }>(
      await app.inject({
        method: 'PUT',
        url: `/stations/brands/${createdBrand.id}`,
        headers: bearerHeaders(token),
        payload: {
          name: 'Alpitronic Prime',
          isActive: false,
        },
      }),
      200,
    );

    assert.equal(updatedBrand.name, 'Alpitronic Prime');
    assert.equal(updatedBrand.isActive, false);

    const createdModel = expectSuccess<{ id: string; brandId: string; name: string; latestTemplateVersion: number | null }>(
      await app.inject({
        method: 'POST',
        url: '/stations/models',
        headers: bearerHeaders(token),
        payload: {
          brandId: createdBrand.id,
          name: 'HYC400',
          description: 'High power charging cabinet',
          imageUrl: 'https://example.com/hyc400.png',
          logoUrl: 'https://example.com/alpitronic.svg',
        },
      }),
      201,
    );

    assert.equal(createdModel.brandId, createdBrand.id);
    assert.equal(createdModel.latestTemplateVersion, null);

    const updatedModel = expectSuccess<{ id: string; name: string; isActive: boolean }>(
      await app.inject({
        method: 'PUT',
        url: `/stations/models/${createdModel.id}`,
        headers: bearerHeaders(token),
        payload: {
          name: 'HYC400 Prime',
          isActive: false,
        },
      }),
      200,
    );

    assert.equal(updatedModel.name, 'HYC400 Prime');
    assert.equal(updatedModel.isActive, false);

    const updatedTemplate = expectSuccess<{
      id: string;
      latestTemplateVersion: number | null;
      latestTemplateConnectors: Array<{ connectorNo: number; connectorType: string }>;
    }>(
      await app.inject({
        method: 'PUT',
        url: `/stations/models/${createdModel.id}/template`,
        headers: bearerHeaders(token),
        payload: {
          connectors: [
            {
              connectorNo: 1,
              connectorType: 'CCS2',
              currentType: 'DC',
              powerKw: 200,
              sortOrder: 1,
            },
            {
              connectorNo: 2,
              connectorType: 'CCS2',
              currentType: 'DC',
              powerKw: 200,
              sortOrder: 2,
            },
          ],
        },
      }),
      200,
    );

    assert.equal(updatedTemplate.latestTemplateVersion, 1);
    assert.deepEqual(
      updatedTemplate.latestTemplateConnectors.map((connector) => [connector.connectorNo, connector.connectorType]),
      [
        [1, 'CCS2'],
        [2, 'CCS2'],
      ],
    );

    const config = expectSuccess<{
      brands: Array<{ id: string; name: string; isActive: boolean }>;
      models: Array<{
        id: string;
        brandId: string;
        name: string;
        isActive: boolean;
        latestTemplateVersion: number | null;
        latestTemplateConnectors: Array<{ connectorNo: number }>;
      }>;
    }>(
      await app.inject({
        method: 'GET',
        url: '/stations/config',
        headers: bearerHeaders(token),
      }),
      200,
    );

    const configBrand = config.brands.find((brand) => brand.id === createdBrand.id);
    const configModel = config.models.find((model) => model.id === createdModel.id);

    assert.equal(configBrand?.name, 'Alpitronic Prime');
    assert.equal(configBrand?.isActive, false);
    assert.equal(configModel?.brandId, createdBrand.id);
    assert.equal(configModel?.name, 'HYC400 Prime');
    assert.equal(configModel?.isActive, false);
    assert.equal(configModel?.latestTemplateVersion, 1);
    assert.equal(configModel?.latestTemplateConnectors.length, 2);
  });

  await t.test('admin can delete unused catalog items and blocks deleting catalog items that are still in use', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');

    const createdBrand = expectSuccess<{ id: string }>(
      await app.inject({
        method: 'POST',
        url: '/stations/brands',
        headers: bearerHeaders(token),
        payload: {
          name: 'Delete Me Brand',
        },
      }),
      201,
    );

    const createdModel = expectSuccess<{ id: string }>(
      await app.inject({
        method: 'POST',
        url: '/stations/models',
        headers: bearerHeaders(token),
        payload: {
          brandId: createdBrand.id,
          name: 'Delete Me Model',
        },
      }),
      201,
    );

    const deletedModel = expectSuccess<{ success: true; id: string }>(
      await app.inject({
        method: 'DELETE',
        url: `/stations/models/${createdModel.id}`,
        headers: bearerHeaders(token),
      }),
      200,
    );

    assert.equal(deletedModel.success, true);
    assert.equal(deletedModel.id, createdModel.id);

    const deletedBrand = expectSuccess<{ success: true; id: string }>(
      await app.inject({
        method: 'DELETE',
        url: `/stations/brands/${createdBrand.id}`,
        headers: bearerHeaders(token),
      }),
      200,
    );

    assert.equal(deletedBrand.success, true);
    assert.equal(deletedBrand.id, createdBrand.id);

    expectError(
      await app.inject({
        method: 'DELETE',
        url: `/stations/models/${fixtureIds.models.terra54}`,
        headers: bearerHeaders(token),
      }),
      409,
      'STATION_MODEL_IN_USE',
    );

    expectError(
      await app.inject({
        method: 'DELETE',
        url: `/stations/brands/${fixtureIds.brands.abb}`,
        headers: bearerHeaders(token),
      }),
      409,
      'STATION_BRAND_IN_USE',
    );
  });

  await t.test('connector validation rejects duplicate numbers in a replacement payload', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const response = await app.inject({
      method: 'PUT',
      url: `/stations/${fixtureIds.stations.existing}`,
      headers: bearerHeaders(token),
      payload: {
        connectors: [
          {
            connectorNo: 1,
            connectorType: 'CCS2',
            currentType: 'DC',
            powerKw: 50,
          },
          {
            connectorNo: 1,
            connectorType: 'Type2',
            currentType: 'AC',
            powerKw: 22,
          },
        ],
      },
    });

    const error = expectError(response, 400, 'STATION_CONNECTOR_DUPLICATE_NO');
    assert.match(error.message, /Connector number 1 is duplicated/i);
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
    assert.equal(data.brandId, fixtureIds.brands.abb);
    assert.equal(data.modelId, fixtureIds.models.terra54);
    assert.equal(data.modelTemplateVersion, null);
    assert.equal(data.socketType, 'CCS2');
    assert.deepEqual(data.connectorSummary.types, ['CCS2']);
    assert.equal(data.connectorSummary.maxPowerKw, 50);
    assert.equal(data.connectorSummary.hasAC, false);
    assert.equal(data.connectorSummary.hasDC, true);
    assert.equal(data.connectorSummary.count, 1);
    assert.equal(data.connectors?.length, 1);
    assert.equal(data.connectors?.[0]?.id, fixtureIds.connectors.existingLive);
    assert.equal(data.connectors?.[0]?.connectorNo, 1);
    assert.equal(data.connectors?.[0]?.connectorType, 'CCS2');
    assert.equal(
      data.summary.latestTestResult === null || stationTestResultValues.includes(data.summary.latestTestResult),
      true,
    );
    assertStationConnectorSummary(data.connectorSummary);
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
      app.inject({
        method: 'POST',
        url: '/stations/brands',
        headers: bearerHeaders(operatorToken),
        payload: {
          name: 'Forbidden Brand',
        },
      }),
      app.inject({
        method: 'DELETE',
        url: `/stations/brands/${fixtureIds.brands.abb}`,
        headers: bearerHeaders(operatorToken),
      }),
      app.inject({
        method: 'DELETE',
        url: `/stations/models/${fixtureIds.models.terra54}`,
        headers: bearerHeaders(operatorToken),
      }),
    ]);

    for (const response of adminOnlyResponses) {
      expectError(response, 403, 'FORBIDDEN');
    }
  });
});
