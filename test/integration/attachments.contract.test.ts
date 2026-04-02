import assert from 'node:assert/strict';
import { test } from 'node:test';

import { env } from '../../src/config/env';
import {
  authHeaders,
  buildMultipartUpload,
  createIssue,
  createTestHistory,
  expectError,
  expectRawResponse,
  expectSuccess,
  loginAndGetToken,
  type AttachmentResponseData,
} from '../helpers/api-contract';
import {
  createTestApp,
  fixtureIds,
  resetIntegrationDb,
} from '../helpers/integration';

test('attachments contract', async (t) => {
  const app = await createTestApp();

  t.after(async () => {
    await app.close();
  });

  await t.test('station attachment upload, list, download, and delete keep the frozen contract', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const fileContents = 'station attachment contract file';
    const upload = buildMultipartUpload({
      content: fileContents,
      contentType: 'text/plain',
      fileName: 'station-notes.txt',
    });

    const uploadResponse = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/attachments`,
      headers: authHeaders(token, upload.headers),
      payload: upload.payload,
    });
    const created = expectSuccess<AttachmentResponseData>(uploadResponse, 201);

    assert.equal(created.stationId, fixtureIds.stations.existing);
    assert.equal(created.issueId, null);
    assert.equal(created.testHistoryId, null);
    assert.equal(created.targetType, 'station');
    assert.equal(created.originalFileName, 'station-notes.txt');
    assert.equal(created.mimeType, 'text/plain');
    assert.equal(created.uploadedBy, fixtureIds.users.operator);
    assert.match(created.downloadUrl, new RegExp(`^/attachments/${created.id}/download$`));

    const listResponse = await app.inject({
      method: 'GET',
      url: `/stations/${fixtureIds.stations.existing}/attachments`,
      headers: authHeaders(token),
    });
    const list = expectSuccess<AttachmentResponseData[]>(listResponse, 200);

    assert.equal(list.length, 1);
    assert.equal(list[0]?.id, created.id);
    assert.equal(list[0]?.targetType, 'station');

    const downloadResponse = await app.inject({
      method: 'GET',
      url: created.downloadUrl,
      headers: authHeaders(token),
    });
    const downloaded = expectRawResponse(downloadResponse, 200, 'text/plain');

    assert.equal(downloaded, fileContents);
    assert.match(String(downloadResponse.headers['content-disposition']), /^attachment;/i);
    assert.equal(downloadResponse.headers['x-content-type-options'], 'nosniff');

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/attachments/${created.id}`,
      headers: authHeaders(token),
    });
    const deleted = expectSuccess<{ success: true; id: string }>(deleteResponse, 200);

    assert.deepEqual(deleted, {
      success: true,
      id: created.id,
    });
  });

  await t.test('issue and test-history attachment endpoints preserve nullable target fields', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const issue = await createIssue(app, token, fixtureIds.stations.existing, {
      title: 'Attachment parent issue',
      severity: 'medium',
    });
    const record = await createTestHistory(app, token, fixtureIds.stations.existing, {
      result: 'warning',
    });

    const issueUpload = buildMultipartUpload({
      content: 'issue attachment',
      contentType: 'text/plain',
      fileName: 'issue.txt',
    });
    const issueResponse = await app.inject({
      method: 'POST',
      url: `/issues/${issue.id}/attachments`,
      headers: authHeaders(token, issueUpload.headers),
      payload: issueUpload.payload,
    });
    const issueAttachment = expectSuccess<AttachmentResponseData>(issueResponse, 201);

    assert.equal(issueAttachment.targetType, 'issue');
    assert.equal(issueAttachment.issueId, issue.id);
    assert.equal(issueAttachment.testHistoryId, null);

    const issueListResponse = await app.inject({
      method: 'GET',
      url: `/issues/${issue.id}/attachments`,
      headers: authHeaders(token),
    });
    const issueList = expectSuccess<AttachmentResponseData[]>(issueListResponse, 200);

    assert.equal(issueList.length, 1);
    assert.equal(issueList[0]?.issueId, issue.id);

    const testUpload = buildMultipartUpload({
      content: 'test history attachment',
      contentType: 'text/plain',
      fileName: 'test-history.txt',
    });
    const testResponse = await app.inject({
      method: 'POST',
      url: `/test-history/${record.id}/attachments`,
      headers: authHeaders(token, testUpload.headers),
      payload: testUpload.payload,
    });
    const testAttachment = expectSuccess<AttachmentResponseData>(testResponse, 201);

    assert.equal(testAttachment.targetType, 'testHistory');
    assert.equal(testAttachment.issueId, null);
    assert.equal(testAttachment.testHistoryId, record.id);

    const testListResponse = await app.inject({
      method: 'GET',
      url: `/test-history/${record.id}/attachments`,
      headers: authHeaders(token),
    });
    const testList = expectSuccess<AttachmentResponseData[]>(testListResponse, 200);

    assert.equal(testList.length, 1);
    assert.equal(testList[0]?.testHistoryId, record.id);
  });

  await t.test('attachment upload rejects unsupported media types with 415', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const upload = buildMultipartUpload({
      content: 'binary-ish',
      contentType: 'application/x-msdownload',
      fileName: 'malware.exe',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/attachments`,
      headers: authHeaders(token, upload.headers),
      payload: upload.payload,
    });

    expectError(response, 415, 'UNSUPPORTED_ATTACHMENT_TYPE');
  });

  await t.test('attachment upload rejects mismatched file extensions with 400', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const upload = buildMultipartUpload({
      content: 'plain text',
      contentType: 'text/plain',
      fileName: 'wrong-extension.pdf',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/attachments`,
      headers: authHeaders(token, upload.headers),
      payload: upload.payload,
    });

    expectError(response, 400, 'INVALID_ATTACHMENT_FILE_NAME');
  });

  await t.test('attachment upload rejects oversized files with 413', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const upload = buildMultipartUpload({
      content: Buffer.alloc(env.ATTACHMENTS_MAX_FILE_SIZE_BYTES + 1, 'a'),
      contentType: 'text/plain',
      fileName: 'too-large.txt',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/attachments`,
      headers: authHeaders(token, upload.headers),
      payload: upload.payload,
    });

    expectError(response, 413, 'ATTACHMENT_TOO_LARGE');
  });

  await t.test('attachment upload requires the multipart file field to be named file', async () => {
    await resetIntegrationDb();

    const { token } = await loginAndGetToken(app, 'operator');
    const upload = buildMultipartUpload({
      content: 'wrong field name',
      contentType: 'text/plain',
      fieldName: 'upload',
      fileName: 'wrong-field.txt',
    });

    const response = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/attachments`,
      headers: authHeaders(token, upload.headers),
      payload: upload.payload,
    });

    expectError(response, 400, 'INVALID_ATTACHMENT_UPLOAD');
  });

  await t.test('viewer cannot upload or delete attachments', async () => {
    await resetIntegrationDb();

    const { token: operatorToken } = await loginAndGetToken(app, 'operator');
    const upload = buildMultipartUpload({
      content: 'viewer forbidden attachment',
      contentType: 'text/plain',
      fileName: 'viewer-forbidden.txt',
    });
    const createdResponse = await app.inject({
      method: 'POST',
      url: `/stations/${fixtureIds.stations.existing}/attachments`,
      headers: authHeaders(operatorToken, upload.headers),
      payload: upload.payload,
    });
    const created = expectSuccess<AttachmentResponseData>(createdResponse, 201);

    const { token: viewerToken } = await loginAndGetToken(app, 'viewer');
    const viewerUpload = buildMultipartUpload({
      content: 'viewer denied',
      contentType: 'text/plain',
      fileName: 'viewer-denied.txt',
    });

    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/stations/${fixtureIds.stations.existing}/attachments`,
        headers: authHeaders(viewerToken, viewerUpload.headers),
        payload: viewerUpload.payload,
      }),
      app.inject({
        method: 'DELETE',
        url: `/attachments/${created.id}`,
        headers: authHeaders(viewerToken),
      }),
    ]);

    for (const response of responses) {
      expectError(response, 403, 'FORBIDDEN');
    }
  });
});
