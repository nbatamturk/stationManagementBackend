import { rm } from 'node:fs/promises';
import path from 'node:path';

import { hash } from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../src/app';
import { env } from '../../src/config/env';
import { db } from '../../src/db/client';
import {
  attachments,
  auditLogs,
  customFieldDefinitions,
  stationCustomFieldValues,
  stationIssueRecords,
  stations,
  stationTestHistory,
  users,
} from '../../src/db/schema';

export const testCredentials = {
  admin: {
    email: 'admin.integration@evlab.local',
    password: 'Admin123!',
  },
  operator: {
    email: 'operator.integration@evlab.local',
    password: 'Operator123!',
  },
  viewer: {
    email: 'viewer.integration@evlab.local',
    password: 'Viewer123!',
  },
  inactiveOperator: {
    email: 'inactive.integration@evlab.local',
    password: 'Inactive123!',
  },
} as const;

export const fixtureIds = {
  users: {
    admin: '11111111-1111-1111-1111-111111111111',
    operator: '22222222-2222-2222-2222-222222222222',
    viewer: '33333333-3333-3333-3333-333333333333',
    inactiveOperator: '44444444-4444-4444-4444-444444444444',
  },
  customFields: {
    firmwareVersion: 'aaaaaaaa-1111-1111-1111-111111111111',
    coolingType: 'aaaaaaaa-2222-2222-2222-222222222222',
    commissioningDate: 'aaaaaaaa-3333-3333-3333-333333333333',
  },
  stations: {
    existing: 'bbbbbbbb-0000-0000-0000-000000000001',
  },
} as const;

const passwordHashesPromise = Promise.all([
  hash(testCredentials.admin.password, 10),
  hash(testCredentials.operator.password, 10),
  hash(testCredentials.viewer.password, 10),
  hash(testCredentials.inactiveOperator.password, 10),
]).then(([admin, operator, viewer, inactiveOperator]) => ({
  admin,
  inactiveOperator,
  operator,
  viewer,
}));

export const createTestApp = async () => {
  const app = buildApp();
  await app.ready();
  return app;
};

const assertSafeIntegrationDb = () => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Integration database reset is only allowed when NODE_ENV=test.');
  }

  const { DATABASE_URL, TEST_DATABASE_URL } = process.env;

  if (!TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is required before running integration database reset.');
  }

  if (!DATABASE_URL || DATABASE_URL !== TEST_DATABASE_URL) {
    throw new Error('Integration database reset requires DATABASE_URL to be explicitly set to TEST_DATABASE_URL.');
  }

  const databaseName = new URL(DATABASE_URL).pathname.replace(/^\/+/, '');

  if (!databaseName || !databaseName.toLowerCase().includes('test')) {
    throw new Error(`Refusing to reset a database that does not look like a test database: "${databaseName}".`);
  }
};

export const resetIntegrationDb = async () => {
  assertSafeIntegrationDb();

  await rm(path.resolve(process.cwd(), env.UPLOADS_DIR), {
    force: true,
    recursive: true,
  });

  const passwordHashes = await passwordHashesPromise;

  await db.delete(auditLogs);
  await db.delete(attachments);
  await db.delete(stationIssueRecords);
  await db.delete(stationTestHistory);
  await db.delete(stationCustomFieldValues);
  await db.delete(customFieldDefinitions);
  await db.delete(stations);
  await db.delete(users);

  await db.insert(users).values([
    {
      id: fixtureIds.users.admin,
      email: testCredentials.admin.email,
      fullName: 'Integration Admin',
      passwordHash: passwordHashes.admin,
      role: 'admin',
      isActive: true,
    },
    {
      id: fixtureIds.users.operator,
      email: testCredentials.operator.email,
      fullName: 'Integration Operator',
      passwordHash: passwordHashes.operator,
      role: 'operator',
      isActive: true,
    },
    {
      id: fixtureIds.users.viewer,
      email: testCredentials.viewer.email,
      fullName: 'Integration Viewer',
      passwordHash: passwordHashes.viewer,
      role: 'viewer',
      isActive: true,
    },
    {
      id: fixtureIds.users.inactiveOperator,
      email: testCredentials.inactiveOperator.email,
      fullName: 'Inactive Operator',
      passwordHash: passwordHashes.inactiveOperator,
      role: 'operator',
      isActive: false,
    },
  ]);

  await db.insert(customFieldDefinitions).values([
    {
      id: fixtureIds.customFields.firmwareVersion,
      key: 'firmware_version',
      label: 'Firmware Version',
      type: 'text',
      optionsJson: {},
      isRequired: true,
      isFilterable: true,
      isVisibleInList: true,
      sortOrder: 1,
      isActive: true,
      createdBy: fixtureIds.users.admin,
      updatedBy: fixtureIds.users.admin,
    },
    {
      id: fixtureIds.customFields.coolingType,
      key: 'cooling_type',
      label: 'Cooling Type',
      type: 'select',
      optionsJson: { options: ['air', 'liquid'] },
      isRequired: true,
      isFilterable: true,
      isVisibleInList: true,
      sortOrder: 2,
      isActive: true,
      createdBy: fixtureIds.users.admin,
      updatedBy: fixtureIds.users.admin,
    },
    {
      id: fixtureIds.customFields.commissioningDate,
      key: 'commissioning_date',
      label: 'Commissioning Date',
      type: 'date',
      optionsJson: {},
      isRequired: false,
      isFilterable: true,
      isVisibleInList: false,
      sortOrder: 3,
      isActive: true,
      createdBy: fixtureIds.users.admin,
      updatedBy: fixtureIds.users.admin,
    },
  ]);

  await db.insert(stations).values({
    id: fixtureIds.stations.existing,
    name: 'Existing Integration Station',
    code: 'INT-EX-001',
    qrCode: 'QR-INT-EX-001',
    brand: 'ABB',
    model: 'Terra 54',
    serialNumber: 'ABB-INT-0001',
    powerKw: '50.00',
    currentType: 'DC',
    socketType: 'CCS2',
    location: 'Integration Lab',
    status: 'active',
    lastTestDate: new Date('2026-03-10T10:00:00.000Z'),
    notes: 'Seeded station for integration tests.',
    isArchived: false,
    archivedAt: null,
    createdBy: fixtureIds.users.admin,
    updatedBy: fixtureIds.users.operator,
  });

  await db.insert(stationCustomFieldValues).values([
    {
      stationId: fixtureIds.stations.existing,
      fieldDefinitionId: fixtureIds.customFields.firmwareVersion,
      valueJson: 'v1.0.0',
    },
    {
      stationId: fixtureIds.stations.existing,
      fieldDefinitionId: fixtureIds.customFields.coolingType,
      valueJson: 'air',
    },
    {
      stationId: fixtureIds.stations.existing,
      fieldDefinitionId: fixtureIds.customFields.commissioningDate,
      valueJson: '2026-01-15T00:00:00.000Z',
    },
  ]);
};

export const buildStationPayload = (suffix: string) => ({
  name: `Integration Station ${suffix}`,
  code: `INT-${suffix}-001`,
  qrCode: `QR-INT-${suffix}-001`,
  brand: 'Siemens',
  model: 'Sicharge D',
  serialNumber: `SIM-INT-${suffix}-001`,
  powerKw: 160,
  currentType: 'DC' as const,
  socketType: 'CCS2' as const,
  location: `Integration Site ${suffix}`,
  status: 'active' as const,
  lastTestDate: '2026-03-20T08:30:00.000Z',
  notes: `Station ${suffix} created by integration test`,
  customFields: {
    cooling_type: 'liquid',
    firmware_version: `v${suffix}.0.0`,
  },
});

export const loginAs = async (
  app: FastifyInstance,
  user: keyof typeof testCredentials,
  options: {
    remoteAddress?: string;
  } = {},
) => {
  const response = await app.inject({
    method: 'POST',
    url: '/auth/login',
    payload: testCredentials[user],
    remoteAddress: options.remoteAddress,
  });

  return response;
};

export const bearerHeaders = (token: string) => ({
  authorization: `Bearer ${token}`,
});
