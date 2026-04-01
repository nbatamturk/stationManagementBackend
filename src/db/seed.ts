import { hash } from 'bcryptjs';

import { db, pool } from './client';
import {
  auditLogs,
  customFieldDefinitions,
  stationCustomFieldValues,
  stationIssueRecords,
  stations,
  stationTestHistory,
  users,
} from './schema';

const seed = async () => {
  const adminPasswordHash = await hash('Admin123!', 10);
  const operatorPasswordHash = await hash('Operator123!', 10);

  const adminUserId = '11111111-1111-1111-1111-111111111111';
  const operatorUserId = '22222222-2222-2222-2222-222222222222';

  const customFieldIds = {
    firmwareVersion: 'aaaaaaaa-1111-1111-1111-111111111111',
    coolingType: 'aaaaaaaa-2222-2222-2222-222222222222',
    networkProvider: 'aaaaaaaa-3333-3333-3333-333333333333',
    installationZone: 'aaaaaaaa-4444-4444-4444-444444444444',
    batteryBufferKwh: 'aaaaaaaa-5555-5555-5555-555555555555',
    commissioningDate: 'aaaaaaaa-6666-6666-6666-666666666666',
  } as const;

  const stationIds = {
    s1: 'bbbbbbbb-0000-0000-0000-000000000001',
    s2: 'bbbbbbbb-0000-0000-0000-000000000002',
    s3: 'bbbbbbbb-0000-0000-0000-000000000003',
    s4: 'bbbbbbbb-0000-0000-0000-000000000004',
    s5: 'bbbbbbbb-0000-0000-0000-000000000005',
    s6: 'bbbbbbbb-0000-0000-0000-000000000006',
    s7: 'bbbbbbbb-0000-0000-0000-000000000007',
    s8: 'bbbbbbbb-0000-0000-0000-000000000008',
  } as const;

  await db.delete(auditLogs);
  await db.delete(stationIssueRecords);
  await db.delete(stationTestHistory);
  await db.delete(stationCustomFieldValues);
  await db.delete(customFieldDefinitions);
  await db.delete(stations);
  await db.delete(users);

  await db.insert(users).values([
    {
      id: adminUserId,
      email: 'admin@evlab.local',
      fullName: 'Aylin Demir',
      passwordHash: adminPasswordHash,
      role: 'admin',
      isActive: true,
    },
    {
      id: operatorUserId,
      email: 'operator@evlab.local',
      fullName: 'Mert Kaya',
      passwordHash: operatorPasswordHash,
      role: 'operator',
      isActive: true,
    },
  ]);

  await db.insert(customFieldDefinitions).values([
    {
      id: customFieldIds.firmwareVersion,
      key: 'firmware_version',
      label: 'Firmware Version',
      type: 'text',
      isRequired: true,
      isFilterable: true,
      isVisibleInList: true,
      sortOrder: 1,
      isActive: true,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    },
    {
      id: customFieldIds.coolingType,
      key: 'cooling_type',
      label: 'Cooling Type',
      type: 'select',
      optionsJson: { options: ['air', 'liquid'] },
      isRequired: true,
      isFilterable: true,
      isVisibleInList: true,
      sortOrder: 2,
      isActive: true,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    },
    {
      id: customFieldIds.networkProvider,
      key: 'network_provider',
      label: 'Network Provider',
      type: 'select',
      optionsJson: { options: ['LTE', 'Ethernet', 'WiFi'] },
      isRequired: false,
      isFilterable: true,
      isVisibleInList: false,
      sortOrder: 3,
      isActive: true,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    },
    {
      id: customFieldIds.installationZone,
      key: 'installation_zone',
      label: 'Installation Zone',
      type: 'text',
      isRequired: false,
      isFilterable: true,
      isVisibleInList: true,
      sortOrder: 4,
      isActive: true,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    },
    {
      id: customFieldIds.batteryBufferKwh,
      key: 'battery_buffer_kwh',
      label: 'Battery Buffer (kWh)',
      type: 'number',
      isRequired: false,
      isFilterable: true,
      isVisibleInList: false,
      sortOrder: 5,
      isActive: true,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    },
    {
      id: customFieldIds.commissioningDate,
      key: 'commissioning_date',
      label: 'Commissioning Date',
      type: 'date',
      isRequired: false,
      isFilterable: true,
      isVisibleInList: false,
      sortOrder: 6,
      isActive: true,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    },
  ]);

  await db.insert(stations).values([
    {
      id: stationIds.s1,
      name: 'Istanbul R&D Bay 1',
      code: 'IST-RD-001',
      qrCode: 'QR-IST-RD-001',
      brand: 'ABB',
      model: 'Terra 184',
      serialNumber: 'ABB-TR184-0001',
      powerKw: '180.00',
      currentType: 'DC',
      socketType: 'CCS2',
      location: 'Istanbul HQ - Test Hall A',
      status: 'active',
      lastTestDate: new Date('2026-03-22T09:30:00.000Z'),
      notes: 'Primary high-power validation station.',
      createdBy: adminUserId,
      updatedBy: operatorUserId,
    },
    {
      id: stationIds.s2,
      name: 'Istanbul R&D Bay 2',
      code: 'IST-RD-002',
      qrCode: 'QR-IST-RD-002',
      brand: 'Siemens',
      model: 'Sicharge D',
      serialNumber: 'SIM-SD-0002',
      powerKw: '160.00',
      currentType: 'DC',
      socketType: 'CCS2',
      location: 'Istanbul HQ - Test Hall A',
      status: 'maintenance',
      lastTestDate: new Date('2026-03-18T11:00:00.000Z'),
      notes: 'Cooling fan replacement in progress.',
      createdBy: adminUserId,
      updatedBy: operatorUserId,
    },
    {
      id: stationIds.s3,
      name: 'Ankara Pilot AC 1',
      code: 'ANK-PLT-001',
      qrCode: 'QR-ANK-PLT-001',
      brand: 'Schneider',
      model: 'EVlink AC',
      serialNumber: 'SCH-EV-0101',
      powerKw: '22.00',
      currentType: 'AC',
      socketType: 'Type2',
      location: 'Ankara Pilot Site - Indoor Lab',
      status: 'active',
      lastTestDate: new Date('2026-03-20T07:10:00.000Z'),
      notes: null,
      createdBy: adminUserId,
      updatedBy: adminUserId,
    },
    {
      id: stationIds.s4,
      name: 'Ankara Pilot DC 1',
      code: 'ANK-PLT-002',
      qrCode: 'QR-ANK-PLT-002',
      brand: 'Tritium',
      model: 'PKM150',
      serialNumber: 'TRI-PKM-1501',
      powerKw: '150.00',
      currentType: 'DC',
      socketType: 'CCS2',
      location: 'Ankara Pilot Site - Outdoor Rig',
      status: 'faulty',
      lastTestDate: new Date('2026-03-14T14:45:00.000Z'),
      notes: 'Intermittent contactor fault observed.',
      createdBy: adminUserId,
      updatedBy: operatorUserId,
    },
    {
      id: stationIds.s5,
      name: 'Izmir Validation AC 2',
      code: 'IZM-VLD-001',
      qrCode: 'QR-IZM-VLD-001',
      brand: 'Delta',
      model: 'AC Mini Plus',
      serialNumber: 'DEL-ACM-2201',
      powerKw: '22.00',
      currentType: 'AC',
      socketType: 'Type2',
      location: 'Izmir Validation Center',
      status: 'inactive',
      lastTestDate: new Date('2026-02-25T08:20:00.000Z'),
      notes: 'Reserved for firmware rollback tests.',
      createdBy: adminUserId,
      updatedBy: operatorUserId,
    },
    {
      id: stationIds.s6,
      name: 'Bursa Field Node 1',
      code: 'BUR-FLD-001',
      qrCode: 'QR-BUR-FLD-001',
      brand: 'ABB',
      model: 'Terra 54',
      serialNumber: 'ABB-TR54-0441',
      powerKw: '50.00',
      currentType: 'DC',
      socketType: 'CCS2',
      location: 'Bursa Field Garage',
      status: 'active',
      lastTestDate: new Date('2026-03-10T10:15:00.000Z'),
      notes: null,
      createdBy: adminUserId,
      updatedBy: operatorUserId,
    },
    {
      id: stationIds.s7,
      name: 'Bursa Field Node 2',
      code: 'BUR-FLD-002',
      qrCode: 'QR-BUR-FLD-002',
      brand: 'Siemens',
      model: 'Sicharge UC',
      serialNumber: 'SIM-UC-0662',
      powerKw: '120.00',
      currentType: 'DC',
      socketType: 'CCS2',
      location: 'Bursa Field Garage',
      status: 'active',
      lastTestDate: new Date('2026-03-19T16:00:00.000Z'),
      notes: 'Used for fleet endurance testing.',
      createdBy: adminUserId,
      updatedBy: operatorUserId,
    },
    {
      id: stationIds.s8,
      name: 'Legacy Station Archive',
      code: 'LEG-ARC-001',
      qrCode: 'QR-LEG-ARC-001',
      brand: 'LegacyTech',
      model: 'LX-30',
      serialNumber: 'LGC-LX30-0009',
      powerKw: '30.00',
      currentType: 'DC',
      socketType: 'CHAdeMO',
      location: 'Istanbul Storage Depot',
      status: 'inactive',
      isArchived: true,
      archivedAt: new Date('2025-12-01T09:00:00.000Z'),
      lastTestDate: new Date('2025-11-20T10:00:00.000Z'),
      notes: 'Archived after decommissioning.',
      createdBy: adminUserId,
      updatedBy: adminUserId,
    },
  ]);

  const values = [
    [stationIds.s1, customFieldIds.firmwareVersion, 'v3.2.7'],
    [stationIds.s1, customFieldIds.coolingType, 'liquid'],
    [stationIds.s1, customFieldIds.networkProvider, 'Ethernet'],
    [stationIds.s1, customFieldIds.installationZone, 'A-01'],
    [stationIds.s1, customFieldIds.batteryBufferKwh, 5.5],
    [stationIds.s1, customFieldIds.commissioningDate, '2025-03-01'],

    [stationIds.s2, customFieldIds.firmwareVersion, 'v3.1.9'],
    [stationIds.s2, customFieldIds.coolingType, 'liquid'],
    [stationIds.s2, customFieldIds.networkProvider, 'LTE'],
    [stationIds.s2, customFieldIds.installationZone, 'A-02'],

    [stationIds.s3, customFieldIds.firmwareVersion, 'v2.0.4'],
    [stationIds.s3, customFieldIds.coolingType, 'air'],
    [stationIds.s3, customFieldIds.networkProvider, 'WiFi'],
    [stationIds.s3, customFieldIds.installationZone, 'B-11'],
    [stationIds.s3, customFieldIds.commissioningDate, '2024-10-17'],

    [stationIds.s4, customFieldIds.firmwareVersion, 'v4.0.1'],
    [stationIds.s4, customFieldIds.coolingType, 'liquid'],
    [stationIds.s4, customFieldIds.networkProvider, 'Ethernet'],
    [stationIds.s4, customFieldIds.installationZone, 'B-12'],

    [stationIds.s5, customFieldIds.firmwareVersion, 'v1.9.5'],
    [stationIds.s5, customFieldIds.coolingType, 'air'],
    [stationIds.s5, customFieldIds.installationZone, 'C-02'],

    [stationIds.s6, customFieldIds.firmwareVersion, 'v2.7.0'],
    [stationIds.s6, customFieldIds.coolingType, 'air'],
    [stationIds.s6, customFieldIds.networkProvider, 'LTE'],
    [stationIds.s6, customFieldIds.installationZone, 'F-01'],

    [stationIds.s7, customFieldIds.firmwareVersion, 'v3.0.8'],
    [stationIds.s7, customFieldIds.coolingType, 'liquid'],
    [stationIds.s7, customFieldIds.networkProvider, 'Ethernet'],
    [stationIds.s7, customFieldIds.installationZone, 'F-02'],

    [stationIds.s8, customFieldIds.firmwareVersion, 'v1.2.0'],
    [stationIds.s8, customFieldIds.coolingType, 'air'],
    [stationIds.s8, customFieldIds.installationZone, 'ARCHIVE'],
  ] as const;

  await db.insert(stationCustomFieldValues).values(
    values.map(([stationId, fieldDefinitionId, valueJson], index) => ({
      id: `cccccccc-0000-0000-0000-${(index + 1).toString().padStart(12, '0')}`,
      stationId,
      fieldDefinitionId,
      valueJson,
    })),
  );

  await db.insert(stationTestHistory).values([
    {
      id: 'dddddddd-0000-0000-0000-000000000001',
      stationId: stationIds.s1,
      testDate: new Date('2026-03-22T09:30:00.000Z'),
      result: 'pass',
      notes: 'Thermal stability passed at 180kW.',
      metricsJson: { peakCurrentA: 402, temperatureC: 44.1 },
      testedBy: operatorUserId,
    },
    {
      id: 'dddddddd-0000-0000-0000-000000000002',
      stationId: stationIds.s1,
      testDate: new Date('2026-03-10T09:00:00.000Z'),
      result: 'warning',
      notes: 'Minor voltage oscillation under load.',
      metricsJson: { ripple: 1.7 },
      testedBy: operatorUserId,
    },
    {
      id: 'dddddddd-0000-0000-0000-000000000003',
      stationId: stationIds.s2,
      testDate: new Date('2026-03-18T11:00:00.000Z'),
      result: 'fail',
      notes: 'Cooling system overheat at minute 17.',
      metricsJson: { maxTempC: 82.5 },
      testedBy: operatorUserId,
    },
    {
      id: 'dddddddd-0000-0000-0000-000000000004',
      stationId: stationIds.s3,
      testDate: new Date('2026-03-20T07:10:00.000Z'),
      result: 'pass',
      notes: 'AC handshake and charging profile stable.',
      metricsJson: { handshakeMs: 410 },
      testedBy: operatorUserId,
    },
    {
      id: 'dddddddd-0000-0000-0000-000000000005',
      stationId: stationIds.s4,
      testDate: new Date('2026-03-14T14:45:00.000Z'),
      result: 'fail',
      notes: 'Contactor did not close consistently.',
      metricsJson: { failureRate: 0.38 },
      testedBy: adminUserId,
    },
    {
      id: 'dddddddd-0000-0000-0000-000000000006',
      stationId: stationIds.s7,
      testDate: new Date('2026-03-19T16:00:00.000Z'),
      result: 'pass',
      notes: 'Fleet test run passed for 6-hour session.',
      metricsJson: { avgPowerKw: 88.3 },
      testedBy: operatorUserId,
    },
  ]);

  await db.insert(stationIssueRecords).values([
    {
      id: 'eeeeeeee-0000-0000-0000-000000000001',
      stationId: stationIds.s2,
      title: 'Cooling fan vibration exceeds threshold',
      description: 'Detected sustained vibration spikes above safe operation limits.',
      severity: 'high',
      status: 'in_progress',
      reportedBy: operatorUserId,
      assignedTo: adminUserId,
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000002',
      stationId: stationIds.s4,
      title: 'Contactor failure during peak output test',
      description: 'Station fails to close contactor under repeated high-load attempts.',
      severity: 'critical',
      status: 'open',
      reportedBy: adminUserId,
      assignedTo: operatorUserId,
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000003',
      stationId: stationIds.s5,
      title: 'Firmware rollback verification pending',
      description: 'Station held inactive until rollback validation completes.',
      severity: 'medium',
      status: 'open',
      reportedBy: operatorUserId,
      assignedTo: operatorUserId,
    },
    {
      id: 'eeeeeeee-0000-0000-0000-000000000004',
      stationId: stationIds.s7,
      title: 'Intermittent LTE signal drop',
      description: 'Short network disconnect events observed during midnight cycle.',
      severity: 'low',
      status: 'resolved',
      resolvedAt: new Date('2026-03-21T02:15:00.000Z'),
      reportedBy: operatorUserId,
      assignedTo: operatorUserId,
    },
  ]);

  await db.insert(auditLogs).values({
    id: 'ffffffff-0000-0000-0000-000000000001',
    actorUserId: adminUserId,
    entityType: 'seed',
    entityId: adminUserId,
    action: 'db.seed.completed',
    metadataJson: {
      users: 2,
      stations: 8,
      customFields: 6,
      testHistoryRecords: 6,
      issueRecords: 4,
    },
  });
};

seed()
  .then(async () => {
    console.log('Seed data inserted successfully.');
    await pool.end();
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await pool.end();
    process.exit(1);
  });
