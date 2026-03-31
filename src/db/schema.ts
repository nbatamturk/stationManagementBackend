import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['admin', 'operator', 'viewer']);
export const stationStatusEnum = pgEnum('station_status', ['active', 'maintenance', 'inactive', 'faulty', 'archived']);
export const currentTypeEnum = pgEnum('current_type', ['AC', 'DC']);
export const socketTypeEnum = pgEnum('socket_type', ['Type2', 'CCS2', 'CHAdeMO', 'GBT', 'NACS', 'Other']);
export const customFieldTypeEnum = pgEnum('custom_field_type', ['text', 'number', 'boolean', 'select', 'date', 'json']);
export const stationTestResultEnum = pgEnum('station_test_result', ['pass', 'fail', 'warning']);
export const issueSeverityEnum = pgEnum('issue_severity', ['low', 'medium', 'high', 'critical']);
export const issueStatusEnum = pgEnum('issue_status', ['open', 'in_progress', 'resolved', 'closed']);

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    email: varchar('email', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 150 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum('role').default('operator').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    usersEmailUnique: uniqueIndex('users_email_unique').on(table.email),
    usersRoleIdx: index('users_role_idx').on(table.role),
    usersActiveIdx: index('users_is_active_idx').on(table.isActive),
  }),
);

export const stations = pgTable(
  'stations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 160 }).notNull(),
    code: varchar('code', { length: 80 }).notNull(),
    qrCode: varchar('qr_code', { length: 150 }).notNull(),
    brand: varchar('brand', { length: 120 }).notNull(),
    model: varchar('model', { length: 120 }).notNull(),
    serialNumber: varchar('serial_number', { length: 150 }).notNull(),
    powerKw: numeric('power_kw', { precision: 10, scale: 2 }).notNull(),
    currentType: currentTypeEnum('current_type').notNull(),
    socketType: socketTypeEnum('socket_type').notNull(),
    location: text('location').notNull(),
    status: stationStatusEnum('status').default('active').notNull(),
    lastTestDate: timestamp('last_test_date', { withTimezone: true }),
    notes: text('notes'),
    isArchived: boolean('is_archived').default(false).notNull(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    stationsCodeUnique: uniqueIndex('stations_code_unique').on(table.code),
    stationsQrCodeUnique: uniqueIndex('stations_qr_code_unique').on(table.qrCode),
    stationsSerialNumberUnique: uniqueIndex('stations_serial_number_unique').on(table.serialNumber),
    stationsStatusIdx: index('stations_status_idx').on(table.status),
    stationsBrandIdx: index('stations_brand_idx').on(table.brand),
    stationsCurrentTypeIdx: index('stations_current_type_idx').on(table.currentType),
    stationsArchivedIdx: index('stations_is_archived_idx').on(table.isArchived),
    stationsCreatedAtIdx: index('stations_created_at_idx').on(table.createdAt),
  }),
);

export const customFieldDefinitions = pgTable(
  'custom_field_definitions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    key: varchar('key', { length: 100 }).notNull(),
    label: varchar('label', { length: 140 }).notNull(),
    type: customFieldTypeEnum('type').notNull(),
    optionsJson: jsonb('options_json').$type<Record<string, unknown>>().default({}).notNull(),
    isRequired: boolean('is_required').default(false).notNull(),
    isFilterable: boolean('is_filterable').default(false).notNull(),
    isVisibleInList: boolean('is_visible_in_list').default(false).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    customFieldKeyUnique: uniqueIndex('custom_field_definitions_key_unique').on(table.key),
    customFieldActiveIdx: index('custom_field_definitions_is_active_idx').on(table.isActive),
    customFieldSortOrderIdx: index('custom_field_definitions_sort_order_idx').on(table.sortOrder),
  }),
);

export const stationCustomFieldValues = pgTable(
  'station_custom_field_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    fieldDefinitionId: uuid('field_definition_id')
      .notNull()
      .references(() => customFieldDefinitions.id, { onDelete: 'cascade' }),
    valueJson: jsonb('value_json').$type<unknown>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    stationCustomFieldUnique: uniqueIndex('station_custom_field_values_station_field_unique').on(
      table.stationId,
      table.fieldDefinitionId,
    ),
    stationCustomFieldStationIdx: index('station_custom_field_values_station_id_idx').on(table.stationId),
    stationCustomFieldDefinitionIdx: index('station_custom_field_values_field_definition_id_idx').on(
      table.fieldDefinitionId,
    ),
  }),
);

export const stationTestHistory = pgTable(
  'station_test_history',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    testDate: timestamp('test_date', { withTimezone: true }).defaultNow().notNull(),
    result: stationTestResultEnum('result').notNull(),
    notes: text('notes'),
    metricsJson: jsonb('metrics_json').$type<Record<string, unknown>>().default({}).notNull(),
    testedBy: uuid('tested_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    stationTestHistoryStationIdx: index('station_test_history_station_id_idx').on(table.stationId),
    stationTestHistoryDateIdx: index('station_test_history_test_date_idx').on(table.testDate),
  }),
);

export const stationIssueRecords = pgTable(
  'station_issue_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 160 }).notNull(),
    description: text('description'),
    severity: issueSeverityEnum('severity').default('medium').notNull(),
    status: issueStatusEnum('status').default('open').notNull(),
    reportedBy: uuid('reported_by').references(() => users.id, { onDelete: 'set null' }),
    assignedTo: uuid('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    stationIssueRecordsStationIdx: index('station_issue_records_station_id_idx').on(table.stationId),
    stationIssueRecordsStatusIdx: index('station_issue_records_status_idx').on(table.status),
    stationIssueRecordsSeverityIdx: index('station_issue_records_severity_idx').on(table.severity),
  }),
);

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    stationId: uuid('station_id')
      .notNull()
      .references(() => stations.id, { onDelete: 'cascade' }),
    issueId: uuid('issue_id').references(() => stationIssueRecords.id, { onDelete: 'cascade' }),
    testHistoryId: uuid('test_history_id').references(() => stationTestHistory.id, { onDelete: 'cascade' }),
    originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 255 }).notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    storagePath: text('storage_path').notNull(),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    attachmentsSingleParentCheck: check(
      'attachments_single_parent_check',
      sql`NOT (${table.issueId} IS NOT NULL AND ${table.testHistoryId} IS NOT NULL)`,
    ),
    attachmentsStationIdx: index('attachments_station_id_idx').on(table.stationId),
    attachmentsIssueIdx: index('attachments_issue_id_idx').on(table.issueId),
    attachmentsTestHistoryIdx: index('attachments_test_history_id_idx').on(table.testHistoryId),
    attachmentsUploadedByIdx: index('attachments_uploaded_by_idx').on(table.uploadedBy),
    attachmentsCreatedAtIdx: index('attachments_created_at_idx').on(table.createdAt),
    attachmentsStoragePathUnique: uniqueIndex('attachments_storage_path_unique').on(table.storagePath),
  }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: uuid('entity_id').notNull(),
    action: varchar('action', { length: 80 }).notNull(),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    auditEntityIdx: index('audit_logs_entity_type_entity_id_idx').on(table.entityType, table.entityId),
    auditActorIdx: index('audit_logs_actor_user_id_idx').on(table.actorUserId),
    auditCreatedAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
);

export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type StationStatus = (typeof stationStatusEnum.enumValues)[number];
export type CurrentType = (typeof currentTypeEnum.enumValues)[number];
export type SocketType = (typeof socketTypeEnum.enumValues)[number];
export type CustomFieldType = (typeof customFieldTypeEnum.enumValues)[number];
export type StationTestResult = (typeof stationTestResultEnum.enumValues)[number];
export type IssueSeverity = (typeof issueSeverityEnum.enumValues)[number];
export type IssueStatus = (typeof issueStatusEnum.enumValues)[number];
