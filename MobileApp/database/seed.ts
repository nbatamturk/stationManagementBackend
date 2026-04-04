import type { SQLiteDatabase } from 'expo-sqlite';

import type { CustomFieldDefinition, StationCurrentType } from '@/types';

const SEED_VERSION = 'initial_v1';

type SeedStationStatus =
  | 'available'
  | 'in_use'
  | 'maintenance'
  | 'offline'
  | 'retired'
  | 'active'
  | 'inactive'
  | 'faulty';

type SeedStation = {
  id: string;
  name: string;
  code: string;
  qrCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: number;
  currentType: StationCurrentType;
  socketType: string;
  location: string;
  status: SeedStationStatus;
  lastTestDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type SeedValue = {
  id: string;
  stationId: string;
  fieldId: string;
  value: string;
};

const customFieldDefinitions: CustomFieldDefinition[] = [
  {
    id: 'cf_firmware',
    key: 'firmwareVersion',
    label: 'Firmware Version',
    type: 'text',
    optionsJson: null,
    isRequired: true,
    isFilterable: false,
    isVisibleInList: true,
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'cf_install_year',
    key: 'installationYear',
    label: 'Installation Year',
    type: 'number',
    optionsJson: null,
    isRequired: false,
    isFilterable: true,
    isVisibleInList: false,
    sortOrder: 2,
    isActive: true,
  },
  {
    id: 'cf_load_balancing',
    key: 'supportsLoadBalancing',
    label: 'Supports Load Balancing',
    type: 'boolean',
    optionsJson: null,
    isRequired: false,
    isFilterable: true,
    isVisibleInList: true,
    sortOrder: 3,
    isActive: true,
  },
  {
    id: 'cf_protocol',
    key: 'communicationProtocol',
    label: 'Communication Protocol',
    type: 'select',
    optionsJson: JSON.stringify(['OCPP 1.6', 'OCPP 2.0.1', 'Proprietary']),
    isRequired: true,
    isFilterable: true,
    isVisibleInList: false,
    sortOrder: 4,
    isActive: true,
  },
  {
    id: 'cf_calibration',
    key: 'lastCalibrationDate',
    label: 'Last Calibration Date',
    type: 'date',
    optionsJson: null,
    isRequired: false,
    isFilterable: false,
    isVisibleInList: false,
    sortOrder: 5,
    isActive: true,
  },
  {
    id: 'cf_test_line',
    key: 'testLine',
    label: 'Test Line',
    type: 'select',
    optionsJson: JSON.stringify(['Line A', 'Line B', 'Line C']),
    isRequired: false,
    isFilterable: true,
    isVisibleInList: true,
    sortOrder: 6,
    isActive: true,
  },
];

const stations: SeedStation[] = [
  {
    id: 'st_001',
    name: 'Ankara FastLab 01',
    code: 'ANK-FAST-01',
    qrCode: 'QR-ANK-FAST-01',
    brand: 'ABB',
    model: 'Terra 54 CJG',
    serialNumber: 'ABB-54-2024-001',
    powerKw: 50,
    currentType: 'DC',
    socketType: 'CCS2',
    location: 'Ankara HQ - Test Hall 1',
    status: 'available',
    lastTestDate: '2026-03-21',
    notes: 'Primary validation unit for thermal tests.',
    createdAt: '2026-01-09T08:30:00.000Z',
    updatedAt: '2026-03-22T09:10:00.000Z',
  },
  {
    id: 'st_002',
    name: 'Istanbul AC Bench 03',
    code: 'IST-AC-03',
    qrCode: 'QR-IST-AC-03',
    brand: 'Siemens',
    model: 'Sicharge D 22',
    serialNumber: 'SIM-22-2023-193',
    powerKw: 22,
    currentType: 'AC',
    socketType: 'Type 2',
    location: 'Istanbul Lab - Bay 2',
    status: 'in_use',
    lastTestDate: '2026-03-27',
    notes: 'Occupied by EMC verification campaign.',
    createdAt: '2026-01-10T08:45:00.000Z',
    updatedAt: '2026-03-28T12:05:00.000Z',
  },
  {
    id: 'st_003',
    name: 'Izmir DC Pilot 07',
    code: 'IZM-DC-07',
    qrCode: 'QR-IZM-DC-07',
    brand: 'Delta',
    model: 'UFC 200',
    serialNumber: 'DLT-200-2024-073',
    powerKw: 120,
    currentType: 'DC',
    socketType: 'CCS2',
    location: 'Izmir R&D - Outdoor Yard',
    status: 'maintenance',
    lastTestDate: '2026-03-02',
    notes: 'Cooling module replacement planned.',
    createdAt: '2026-01-14T10:00:00.000Z',
    updatedAt: '2026-03-20T15:20:00.000Z',
  },
  {
    id: 'st_004',
    name: 'Bursa Fleet AC 02',
    code: 'BRS-AC-02',
    qrCode: 'QR-BRS-AC-02',
    brand: 'Schneider Electric',
    model: 'EVlink Pro AC',
    serialNumber: 'SCH-AC-02-556',
    powerKw: 11,
    currentType: 'AC',
    socketType: 'Type 2',
    location: 'Bursa Vehicle Fleet Area',
    status: 'available',
    lastTestDate: '2026-03-17',
    notes: 'Stable reference station for regression tests.',
    createdAt: '2026-01-18T07:15:00.000Z',
    updatedAt: '2026-03-17T11:35:00.000Z',
  },
  {
    id: 'st_005',
    name: 'Eskisehir Ultra 01',
    code: 'ESK-ULT-01',
    qrCode: 'QR-ESK-ULT-01',
    brand: 'ABB',
    model: 'Terra 184',
    serialNumber: 'ABB-184-2025-011',
    powerKw: 180,
    currentType: 'DC',
    socketType: 'CCS2',
    location: 'Eskisehir Power Electronics Lab',
    status: 'offline',
    lastTestDate: '2026-02-19',
    notes: 'Offline pending isolation test report.',
    createdAt: '2026-01-20T06:40:00.000Z',
    updatedAt: '2026-03-11T14:05:00.000Z',
  },
  {
    id: 'st_006',
    name: 'Kocaeli Mixed Hub 05',
    code: 'KOC-MIX-05',
    qrCode: 'QR-KOC-MIX-05',
    brand: 'Vestel',
    model: 'EVC04-DC',
    serialNumber: 'VST-DC-05-2109',
    powerKw: 60,
    currentType: 'DC',
    socketType: 'CCS2/CHAdeMO',
    location: 'Kocaeli Integration Center',
    status: 'available',
    lastTestDate: '2026-03-24',
    notes: 'Dual connector compatibility testing.',
    createdAt: '2026-01-24T09:05:00.000Z',
    updatedAt: '2026-03-25T16:10:00.000Z',
  },
  {
    id: 'st_007',
    name: 'Manisa Legacy AC 09',
    code: 'MNS-LEG-09',
    qrCode: 'QR-MNS-LEG-09',
    brand: 'Efacec',
    model: 'QC45',
    serialNumber: 'EFC-QC45-9090',
    powerKw: 43,
    currentType: 'AC',
    socketType: 'Type 2',
    location: 'Manisa Archive Lab',
    status: 'retired',
    lastTestDate: '2025-12-01',
    notes: 'Kept for legacy interoperability checks only.',
    createdAt: '2026-01-30T12:20:00.000Z',
    updatedAt: '2026-03-05T08:45:00.000Z',
  },
  {
    id: 'st_008',
    name: 'Gebze Validation DC 12',
    code: 'GBZ-VAL-12',
    qrCode: 'QR-GBZ-VAL-12',
    brand: 'Siemens',
    model: 'Sicharge UC 150',
    serialNumber: 'SIM-UC150-654',
    powerKw: 150,
    currentType: 'DC',
    socketType: 'CCS2',
    location: 'Gebze Validation Site',
    status: 'in_use',
    lastTestDate: '2026-03-28',
    notes: 'Long-duration endurance test running this week.',
    createdAt: '2026-02-03T11:10:00.000Z',
    updatedAt: '2026-03-28T18:25:00.000Z',
  },
];

const customValues: SeedValue[] = [
  { id: 'v_001', stationId: 'st_001', fieldId: 'cf_firmware', value: 'v2.4.1' },
  { id: 'v_002', stationId: 'st_001', fieldId: 'cf_install_year', value: '2024' },
  { id: 'v_003', stationId: 'st_001', fieldId: 'cf_load_balancing', value: 'true' },
  { id: 'v_004', stationId: 'st_001', fieldId: 'cf_protocol', value: 'OCPP 2.0.1' },
  { id: 'v_005', stationId: 'st_001', fieldId: 'cf_calibration', value: '2026-01-18' },
  { id: 'v_006', stationId: 'st_001', fieldId: 'cf_test_line', value: 'Line A' },

  { id: 'v_007', stationId: 'st_002', fieldId: 'cf_firmware', value: 'v1.9.6' },
  { id: 'v_008', stationId: 'st_002', fieldId: 'cf_install_year', value: '2023' },
  { id: 'v_009', stationId: 'st_002', fieldId: 'cf_load_balancing', value: 'false' },
  { id: 'v_010', stationId: 'st_002', fieldId: 'cf_protocol', value: 'OCPP 1.6' },
  { id: 'v_011', stationId: 'st_002', fieldId: 'cf_calibration', value: '2026-02-02' },
  { id: 'v_012', stationId: 'st_002', fieldId: 'cf_test_line', value: 'Line B' },

  { id: 'v_013', stationId: 'st_003', fieldId: 'cf_firmware', value: 'v3.0.0-beta' },
  { id: 'v_014', stationId: 'st_003', fieldId: 'cf_install_year', value: '2024' },
  { id: 'v_015', stationId: 'st_003', fieldId: 'cf_load_balancing', value: 'true' },
  { id: 'v_016', stationId: 'st_003', fieldId: 'cf_protocol', value: 'Proprietary' },
  { id: 'v_017', stationId: 'st_003', fieldId: 'cf_calibration', value: '2025-11-20' },
  { id: 'v_018', stationId: 'st_003', fieldId: 'cf_test_line', value: 'Line C' },

  { id: 'v_019', stationId: 'st_004', fieldId: 'cf_firmware', value: 'v1.2.4' },
  { id: 'v_020', stationId: 'st_004', fieldId: 'cf_install_year', value: '2022' },
  { id: 'v_021', stationId: 'st_004', fieldId: 'cf_load_balancing', value: 'false' },
  { id: 'v_022', stationId: 'st_004', fieldId: 'cf_protocol', value: 'OCPP 1.6' },
  { id: 'v_023', stationId: 'st_004', fieldId: 'cf_calibration', value: '2026-03-09' },
  { id: 'v_024', stationId: 'st_004', fieldId: 'cf_test_line', value: 'Line A' },

  { id: 'v_025', stationId: 'st_005', fieldId: 'cf_firmware', value: 'v4.1.0' },
  { id: 'v_026', stationId: 'st_005', fieldId: 'cf_install_year', value: '2025' },
  { id: 'v_027', stationId: 'st_005', fieldId: 'cf_load_balancing', value: 'true' },
  { id: 'v_028', stationId: 'st_005', fieldId: 'cf_protocol', value: 'OCPP 2.0.1' },
  { id: 'v_029', stationId: 'st_005', fieldId: 'cf_calibration', value: '2026-01-07' },
  { id: 'v_030', stationId: 'st_005', fieldId: 'cf_test_line', value: 'Line B' },

  { id: 'v_031', stationId: 'st_006', fieldId: 'cf_firmware', value: 'v2.1.8' },
  { id: 'v_032', stationId: 'st_006', fieldId: 'cf_install_year', value: '2024' },
  { id: 'v_033', stationId: 'st_006', fieldId: 'cf_load_balancing', value: 'true' },
  { id: 'v_034', stationId: 'st_006', fieldId: 'cf_protocol', value: 'OCPP 1.6' },
  { id: 'v_035', stationId: 'st_006', fieldId: 'cf_calibration', value: '2026-03-01' },
  { id: 'v_036', stationId: 'st_006', fieldId: 'cf_test_line', value: 'Line C' },

  { id: 'v_037', stationId: 'st_007', fieldId: 'cf_firmware', value: 'v0.9.2' },
  { id: 'v_038', stationId: 'st_007', fieldId: 'cf_install_year', value: '2019' },
  { id: 'v_039', stationId: 'st_007', fieldId: 'cf_load_balancing', value: 'false' },
  { id: 'v_040', stationId: 'st_007', fieldId: 'cf_protocol', value: 'Proprietary' },
  { id: 'v_041', stationId: 'st_007', fieldId: 'cf_calibration', value: '2025-06-14' },
  { id: 'v_042', stationId: 'st_007', fieldId: 'cf_test_line', value: 'Line A' },

  { id: 'v_043', stationId: 'st_008', fieldId: 'cf_firmware', value: 'v3.5.4' },
  { id: 'v_044', stationId: 'st_008', fieldId: 'cf_install_year', value: '2025' },
  { id: 'v_045', stationId: 'st_008', fieldId: 'cf_load_balancing', value: 'true' },
  { id: 'v_046', stationId: 'st_008', fieldId: 'cf_protocol', value: 'OCPP 2.0.1' },
  { id: 'v_047', stationId: 'st_008', fieldId: 'cf_calibration', value: '2026-02-25' },
  { id: 'v_048', stationId: 'st_008', fieldId: 'cf_test_line', value: 'Line B' },
];

const boolToInt = (value: boolean): number => (value ? 1 : 0);

const seedCustomFields = async (db: SQLiteDatabase): Promise<void> => {
  for (const definition of customFieldDefinitions) {
    await db.runAsync(
      `INSERT INTO custom_field_definitions
        (id, key, label, type, optionsJson, isRequired, isFilterable, isVisibleInList, sortOrder, isActive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        key = excluded.key,
        label = excluded.label,
        type = excluded.type,
        optionsJson = excluded.optionsJson,
        isRequired = excluded.isRequired,
        isFilterable = excluded.isFilterable,
        isVisibleInList = excluded.isVisibleInList,
        sortOrder = excluded.sortOrder,
        isActive = excluded.isActive;`,
      definition.id,
      definition.key,
      definition.label,
      definition.type,
      definition.optionsJson,
      boolToInt(definition.isRequired),
      boolToInt(definition.isFilterable),
      boolToInt(definition.isVisibleInList),
      definition.sortOrder,
      boolToInt(definition.isActive),
    );
  }
};

const seedStations = async (db: SQLiteDatabase): Promise<void> => {
  for (const station of stations) {
    await db.runAsync(
      `INSERT INTO stations
        (id, name, code, qrCode, brand, model, serialNumber, powerKw, currentType, socketType, location, status, lastTestDate, notes, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        code = excluded.code,
        qrCode = excluded.qrCode,
        brand = excluded.brand,
        model = excluded.model,
        serialNumber = excluded.serialNumber,
        powerKw = excluded.powerKw,
        currentType = excluded.currentType,
        socketType = excluded.socketType,
        location = excluded.location,
        status = excluded.status,
        lastTestDate = excluded.lastTestDate,
        notes = excluded.notes,
        updatedAt = excluded.updatedAt;`,
      station.id,
      station.name,
      station.code,
      station.qrCode,
      station.brand,
      station.model,
      station.serialNumber,
      station.powerKw,
      station.currentType,
      station.socketType,
      station.location,
      station.status,
      station.lastTestDate,
      station.notes,
      station.createdAt,
      station.updatedAt,
    );
  }
};

const seedValues = async (db: SQLiteDatabase): Promise<void> => {
  for (const item of customValues) {
    await db.runAsync(
      `INSERT INTO station_custom_field_values (id, stationId, fieldId, value)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(stationId, fieldId) DO UPDATE SET value = excluded.value;`,
      item.id,
      item.stationId,
      item.fieldId,
      item.value,
    );
  }
};

const setSeedVersion = async (db: SQLiteDatabase): Promise<void> => {
  await db.runAsync(
    `INSERT INTO app_meta (key, value)
     VALUES ('seed_version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    SEED_VERSION,
  );
};

export const seedDatabaseIfNeeded = async (db: SQLiteDatabase): Promise<void> => {
  const seedVersion = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_meta WHERE key = ?',
    'seed_version',
  );

  if (seedVersion?.value === SEED_VERSION) {
    return;
  }

  const stationCount = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM stations;',
  );

  const hasExistingStations = (stationCount?.count ?? 0) > 0;

  if (hasExistingStations && !seedVersion) {
    await setSeedVersion(db);
    return;
  }

  if (!hasExistingStations) {
    await db.withTransactionAsync(async () => {
      await seedCustomFields(db);
      await seedStations(db);
      await seedValues(db);
      await setSeedVersion(db);
    });
    return;
  }

  await setSeedVersion(db);
};
