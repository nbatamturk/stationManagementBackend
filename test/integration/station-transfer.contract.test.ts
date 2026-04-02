import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildMultipartUpload,
  expectError,
  expectPaginated,
  expectRawResponse,
  expectSuccess,
  loginAndGetToken,
  type StationResponseData,
} from '../helpers/api-contract';
import {
  bearerHeaders,
  createTestApp,
  resetIntegrationDb,
} from '../helpers/integration';

type StationImportPreviewData = {
  fileName: string | null;
  headers: string[];
  rules: {
    customFieldPrefix: string;
    mode: 'upsert';
  };
  columns: {
    unknownColumns: string[];
    unknownCustomFields: string[];
    missingRequiredColumns: string[];
    missingRequiredCustomFieldColumns: string[];
  };
  summary: {
    totalRows: number;
    validRows: number;
    invalidRows: number;
    createCandidates: number;
    updateCandidates: number;
    skipCandidates: number;
  };
  rows: Array<{
    rowNumber: number;
    status: 'valid' | 'invalid';
    action: 'create' | 'update' | 'skip';
    canApply: boolean;
    existingStationId: string | null;
    issues: Array<{ code: string }>;
    candidate: {
      rowNumber: number;
      station: {
        name: string;
        code: string;
        qrCode: string;
        brand: string;
        model: string;
        serialNumber: string;
        powerKw: number;
        currentType: 'AC' | 'DC';
        socketType: 'Type2' | 'CCS2' | 'CHAdeMO' | 'GBT' | 'NACS' | 'Other';
        location: string;
        status?: 'active' | 'maintenance' | 'inactive' | 'faulty';
        isArchived?: boolean;
        lastTestDate?: string;
        notes?: string;
      };
      customFields?: Record<string, unknown>;
    } | null;
  }>;
};

type StationImportApplyData = {
  mode: 'upsert';
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedRows: Array<{
    rowNumber: number;
    code: string | null;
    message: string;
    issues: Array<{ code: string }>;
  }>;
};

const buildCsv = (rows: string[]) => rows.join('\n');

const validImportCsv = buildCsv([
  'name,code,qrCode,brand,model,serialNumber,powerKw,currentType,socketType,location,status,isArchived,lastTestDate,notes,cf.firmware_version,cf.cooling_type',
  'CSV Import Station,CSV-NEW-001,QR-CSV-NEW-001,ABB,Terra 54,CSV-SN-001,50,DC,CCS2,Import Site,active,false,2026-03-20T08:30:00.000Z,Imported via contract test,v9.9.9,air',
]);

test('station transfer contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('station export remains a raw CSV contract exception', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'GET',
      url: '/exports/stations.csv',
      headers: bearerHeaders(token),
    });
    const csv = expectRawResponse(response, 200, 'text/csv');

    assert.match(String(response.headers['content-disposition']), /^attachment;\s*filename=/i);
    assert.match(csv, /name,code,qrCode/i);
    assert.match(csv, /Existing Integration Station/);
  });

  await t.test('preview station import returns wrapped preview metadata and candidates', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const upload = buildMultipartUpload({
      content: validImportCsv,
      contentType: 'text/csv',
      fileName: 'stations-import.csv',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/imports/stations/preview',
      headers: {
        ...bearerHeaders(token),
        ...upload.headers,
      },
      payload: upload.payload,
    });
    const data = expectSuccess<StationImportPreviewData>(response, 200);

    assert.equal(data.fileName, 'stations-import.csv');
    assert.equal(data.rules.mode, 'upsert');
    assert.equal(data.rules.customFieldPrefix, 'cf.');
    assert.deepEqual(data.columns.unknownColumns, []);
    assert.deepEqual(data.columns.missingRequiredColumns, []);
    assert.deepEqual(data.columns.missingRequiredCustomFieldColumns, []);
    assert.equal(data.summary.totalRows, 1);
    assert.equal(data.summary.validRows, 1);
    assert.equal(data.summary.createCandidates, 1);
    assert.equal(data.rows[0]?.status, 'valid');
    assert.equal(data.rows[0]?.action, 'create');
    assert.equal(data.rows[0]?.candidate?.station.code, 'CSV-NEW-001');
  });

  await t.test('invalid csv upload returns stable wrapped errors', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const upload = buildMultipartUpload({
      content: '',
      contentType: 'text/csv',
      fileName: 'empty.csv',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/imports/stations/preview',
      headers: {
        ...bearerHeaders(token),
        ...upload.headers,
      },
      payload: upload.payload,
    });

    expectError(response, 400, 'INVALID_CSV');
  });

  await t.test('csv import preview requires the multipart file field to be named file', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const upload = buildMultipartUpload({
      content: validImportCsv,
      contentType: 'text/csv',
      fieldName: 'upload',
      fileName: 'stations-import.csv',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/imports/stations/preview',
      headers: {
        ...bearerHeaders(token),
        ...upload.headers,
      },
      payload: upload.payload,
    });

    expectError(response, 400, 'INVALID_CSV_UPLOAD');
  });

  await t.test('preview station import flags unsafe numeric and text bounds', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const upload = buildMultipartUpload({
      content: buildCsv([
        'name,code,qrCode,brand,model,serialNumber,powerKw,currentType,socketType,location,status,isArchived,lastTestDate,notes,cf.firmware_version,cf.cooling_type',
        `Bounded Import Station,CSV-LIMIT-001,QR-CSV-LIMIT-001,ABB,Terra 54,CSV-SN-LIMIT-001,1001,DC,CCS2,${'L'.repeat(501)},active,false,2026-03-20T08:30:00.000Z,${'N'.repeat(2001)},v9.9.9,air`,
      ]),
      contentType: 'text/csv',
      fileName: 'stations-import-invalid.csv',
    });

    const response = await app.inject({
      method: 'POST',
      url: '/imports/stations/preview',
      headers: {
        ...bearerHeaders(token),
        ...upload.headers,
      },
      payload: upload.payload,
    });
    const data = expectSuccess<StationImportPreviewData>(response, 200);
    const firstRow = data.rows[0];

    assert.equal(firstRow?.status, 'invalid');
    assert.equal(firstRow?.canApply, false);
    assert.deepEqual(
      firstRow?.issues.map((issue) => issue.code).sort(),
      ['INVALID_NUMBER_RANGE', 'VALUE_TOO_LONG', 'VALUE_TOO_LONG'].sort(),
    );
  });

  await t.test('apply station import creates stations from preview candidates', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const previewUpload = buildMultipartUpload({
      content: validImportCsv,
      contentType: 'text/csv',
      fileName: 'stations-import.csv',
    });
    const previewResponse = await app.inject({
      method: 'POST',
      url: '/imports/stations/preview',
      headers: {
        ...bearerHeaders(token),
        ...previewUpload.headers,
      },
      payload: previewUpload.payload,
    });
    const preview = expectSuccess<StationImportPreviewData>(previewResponse, 200);

    const candidate = preview.rows[0]?.candidate;
    assert.ok(candidate);

    const applyResponse = await app.inject({
      method: 'POST',
      url: '/imports/stations/apply',
      headers: bearerHeaders(token),
      payload: {
        rows: [candidate],
      },
    });
    const applied = expectSuccess<StationImportApplyData>(applyResponse, 200);

    assert.equal(applied.mode, 'upsert');
    assert.equal(applied.totalRows, 1);
    assert.equal(applied.createdCount, 1);
    assert.equal(applied.updatedCount, 0);
    assert.equal(applied.failedRows.length, 0);

    const stationResponse = await app.inject({
      method: 'GET',
      url: '/stations?code=CSV-NEW-001',
      headers: bearerHeaders(token),
    });
    const stationList = expectPaginated<StationResponseData>(stationResponse, 200);

    assert.equal(stationList.data.length, 1);
    assert.equal(stationList.data[0]?.code, 'CSV-NEW-001');
  });

  await t.test('apply station import reports failed rows without changing the envelope shape', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const response = await app.inject({
      method: 'POST',
      url: '/imports/stations/apply',
      headers: bearerHeaders(token),
      payload: {
        rows: [
          {
            rowNumber: 2,
            station: {
              name: 'Invalid Import Station',
              code: 'CSV-FAIL-001',
              qrCode: 'QR-CSV-FAIL-001',
              brand: 'ABB',
              model: 'Terra 54',
              serialNumber: 'CSV-SN-FAIL-001',
              powerKw: 50,
              currentType: 'DC',
              socketType: 'CCS2',
              location: 'Import Site',
            },
            customFields: {
              cooling_type: 'air',
            },
          },
        ],
      },
    });
    const applied = expectSuccess<StationImportApplyData>(response, 200);

    assert.equal(applied.createdCount, 0);
    assert.equal(applied.updatedCount, 0);
    assert.equal(applied.failedRows.length, 1);
    assert.equal(applied.failedRows[0]?.issues[0]?.code, 'MISSING_REQUIRED_CUSTOM_FIELDS');
  });

  await t.test('apply station import rejects unexpected top-level and nested properties', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'admin');
    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/imports/stations/apply',
        headers: bearerHeaders(token),
        payload: {
          rows: [
            {
              rowNumber: 2,
              station: {
                name: 'Strict Root Station',
                code: 'CSV-STRICT-001',
                qrCode: 'QR-CSV-STRICT-001',
                brand: 'ABB',
                model: 'Terra 54',
                serialNumber: 'CSV-SN-STRICT-001',
                powerKw: 50,
                currentType: 'DC',
                socketType: 'CCS2',
                location: 'Import Site',
              },
            },
          ],
          unexpected: true,
        },
      }),
      app.inject({
        method: 'POST',
        url: '/imports/stations/apply',
        headers: bearerHeaders(token),
        payload: {
          rows: [
            {
              rowNumber: 2,
              station: {
                name: 'Strict Nested Station',
                code: 'CSV-STRICT-002',
                qrCode: 'QR-CSV-STRICT-002',
                brand: 'ABB',
                model: 'Terra 54',
                serialNumber: 'CSV-SN-STRICT-002',
                powerKw: 50,
                currentType: 'DC',
                socketType: 'CCS2',
                location: 'Import Site',
                unexpected: true,
              },
            },
          ],
        },
      }),
    ]);

    for (const response of responses) {
      expectError(response, 400, 'VALIDATION_ERROR');
    }
  });

  await t.test('operator and viewer cannot access admin-only import actions', async () => {
    await resetIntegrationDb();

    const { token: operatorToken } = await loginAndGetToken(app, 'operator');
    const { token: viewerToken } = await loginAndGetToken(app, 'viewer');
    const upload = buildMultipartUpload({
      content: validImportCsv,
      contentType: 'text/csv',
      fileName: 'stations-import.csv',
    });

    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/imports/stations/preview',
        headers: {
          ...bearerHeaders(operatorToken),
          ...upload.headers,
        },
        payload: upload.payload,
      }),
      app.inject({
        method: 'POST',
        url: '/imports/stations/apply',
        headers: bearerHeaders(operatorToken),
        payload: {
          rows: [
            {
              rowNumber: 2,
              station: {
                name: 'Forbidden Import Station',
                code: 'CSV-FORBIDDEN-001',
                qrCode: 'QR-CSV-FORBIDDEN-001',
                brand: 'ABB',
                model: 'Terra 54',
                serialNumber: 'CSV-SN-FORBIDDEN-001',
                powerKw: 50,
                currentType: 'DC',
                socketType: 'CCS2',
                location: 'Import Site',
              },
            },
          ],
        },
      }),
      app.inject({
        method: 'POST',
        url: '/imports/stations/apply',
        headers: bearerHeaders(viewerToken),
        payload: {
          rows: [
            {
              rowNumber: 2,
              station: {
                name: 'Viewer Forbidden Import Station',
                code: 'CSV-FORBIDDEN-002',
                qrCode: 'QR-CSV-FORBIDDEN-002',
                brand: 'ABB',
                model: 'Terra 54',
                serialNumber: 'CSV-SN-FORBIDDEN-002',
                powerKw: 50,
                currentType: 'DC',
                socketType: 'CCS2',
                location: 'Import Site',
              },
            },
          ],
        },
      }),
    ]);

    for (const response of responses) {
      expectError(response, 403, 'FORBIDDEN');
    }
  });
});
