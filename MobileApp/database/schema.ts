import type { SQLiteDatabase } from 'expo-sqlite';

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS stations (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      qrCode TEXT NOT NULL UNIQUE,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      serialNumber TEXT NOT NULL UNIQUE,
      powerKw REAL NOT NULL,
      currentType TEXT NOT NULL CHECK(currentType IN ('AC', 'DC')),
      socketType TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL,
      lastTestDate TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS custom_field_definitions (
      id TEXT PRIMARY KEY NOT NULL,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      type TEXT NOT NULL,
      optionsJson TEXT,
      isRequired INTEGER NOT NULL DEFAULT 0,
      isFilterable INTEGER NOT NULL DEFAULT 0,
      isVisibleInList INTEGER NOT NULL DEFAULT 0,
      sortOrder INTEGER NOT NULL DEFAULT 0,
      isActive INTEGER NOT NULL DEFAULT 1
  );`,
  `CREATE TABLE IF NOT EXISTS station_custom_field_values (
      id TEXT PRIMARY KEY NOT NULL,
      stationId TEXT NOT NULL,
      fieldId TEXT NOT NULL,
      value TEXT NOT NULL,
      FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE CASCADE,
      FOREIGN KEY (fieldId) REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
      UNIQUE(stationId, fieldId)
  );`,
  `CREATE TABLE IF NOT EXISTS station_test_history (
      id TEXT PRIMARY KEY NOT NULL,
      stationId TEXT NOT NULL,
      testType TEXT NOT NULL,
      result TEXT NOT NULL,
      performedAt TEXT NOT NULL,
      performedBy TEXT,
      notes TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS station_issue_records (
      id TEXT PRIMARY KEY NOT NULL,
      stationId TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      reportedAt TEXT NOT NULL,
      resolvedAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE CASCADE
  );`,
  `CREATE TABLE IF NOT EXISTS station_photo_attachments (
      id TEXT PRIMARY KEY NOT NULL,
      stationId TEXT NOT NULL,
      testHistoryId TEXT,
      issueId TEXT,
      localUri TEXT NOT NULL,
      mimeType TEXT,
      fileName TEXT,
      fileSize INTEGER,
      syncStatus TEXT NOT NULL DEFAULT 'local',
      createdAt TEXT NOT NULL,
      FOREIGN KEY (stationId) REFERENCES stations(id) ON DELETE CASCADE,
      FOREIGN KEY (testHistoryId) REFERENCES station_test_history(id) ON DELETE SET NULL,
      FOREIGN KEY (issueId) REFERENCES station_issue_records(id) ON DELETE SET NULL
  );`,
  `CREATE TABLE IF NOT EXISTS data_exchange_runs (
      id TEXT PRIMARY KEY NOT NULL,
      operationType TEXT NOT NULL,
      status TEXT NOT NULL,
      dataFormat TEXT NOT NULL,
      fileUri TEXT,
      summaryJson TEXT,
      errorMessage TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      displayName TEXT NOT NULL,
      role TEXT NOT NULL,
      isActive INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
      role TEXT NOT NULL,
      permissionKey TEXT NOT NULL,
      PRIMARY KEY (role, permissionKey)
  );`,
  'CREATE INDEX IF NOT EXISTS idx_stations_name ON stations(name);',
  'CREATE INDEX IF NOT EXISTS idx_stations_status ON stations(status);',
  'CREATE INDEX IF NOT EXISTS idx_stations_brand ON stations(brand);',
  'CREATE INDEX IF NOT EXISTS idx_stations_current_type ON stations(currentType);',
  'CREATE INDEX IF NOT EXISTS idx_station_custom_station ON station_custom_field_values(stationId);',
  'CREATE INDEX IF NOT EXISTS idx_station_custom_field ON station_custom_field_values(fieldId);',
  'CREATE INDEX IF NOT EXISTS idx_test_history_station ON station_test_history(stationId);',
  'CREATE INDEX IF NOT EXISTS idx_issue_station ON station_issue_records(stationId);',
  'CREATE INDEX IF NOT EXISTS idx_attachment_station ON station_photo_attachments(stationId);',
  'CREATE INDEX IF NOT EXISTS idx_attachment_test ON station_photo_attachments(testHistoryId);',
  'CREATE INDEX IF NOT EXISTS idx_attachment_issue ON station_photo_attachments(issueId);',
  'CREATE INDEX IF NOT EXISTS idx_exchange_operation ON data_exchange_runs(operationType);',
  'CREATE INDEX IF NOT EXISTS idx_users_role ON app_users(role);',
];

export const applySchema = async (db: SQLiteDatabase): Promise<void> => {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  for (const statement of schemaStatements) {
    await db.execAsync(statement);
  }
};
