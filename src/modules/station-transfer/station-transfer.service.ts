import { randomUUID } from 'crypto';
import { isDeepStrictEqual } from 'util';

import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stations, type CurrentType, type SocketType, type StationStatus } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { isUniqueViolation } from '../../utils/db-errors';
import { AppError } from '../../utils/errors';

import { customFieldsService } from '../custom-fields/custom-fields.service';
import { stationsRepository } from '../stations/stations.repository';
import { stationsService } from '../stations/stations.service';
import {
  customFieldColumnPrefix,
  stationCurrentTypeValues,
  stationExportBaseColumns,
  stationImportOptionalColumns,
  stationImportReadonlyColumns,
  stationImportRequiredColumns,
  stationSocketTypeValues,
  stationStatusValues,
  type StationCsvAction,
} from './station-transfer.constants';
import { parseCsvDocument, serializeCsv, type ParsedCsvRow } from './station-transfer.csv';

type ExportQuery = Record<string, unknown>;
type CustomFieldDefinition = Awaited<ReturnType<typeof customFieldsService.listDefinitions>>[number];
type ExistingStation = Awaited<ReturnType<typeof stationsRepository.findByUniqueFields>>[number];
type StationListItem = Awaited<ReturnType<typeof stationsService.listFull>>['data'][number];

type StationImportIssue = {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  field: string | null;
  value?: string | null;
  relatedRowNumbers?: number[];
  existingStationId?: string | null;
};

type StationImportStationInput = {
  name: string;
  code: string;
  qrCode: string;
  brand: string;
  model: string;
  serialNumber: string;
  powerKw: number;
  currentType: CurrentType;
  socketType: SocketType;
  location: string;
  status?: StationStatus;
  isArchived?: boolean;
  lastTestDate?: string;
  notes?: string;
};

type StationImportApplyRow = {
  rowNumber: number;
  station: StationImportStationInput;
  customFields?: Record<string, unknown>;
};

type PreviewCandidateRow = {
  rowNumber: number;
  raw: Record<string, string>;
  station: Partial<StationImportStationInput>;
  customFields: Record<string, unknown>;
  issues: StationImportIssue[];
};

type EvaluatedImportRow = {
  rowNumber: number;
  raw: Record<string, string>;
  issues: StationImportIssue[];
  status: 'valid' | 'invalid';
  action: StationCsvAction;
  canApply: boolean;
  existingStationId: string | null;
  candidate: StationImportApplyRow | null;
};

type FileHeaderAnalysis = {
  headers: string[];
  headerSet: Set<string>;
  unknownColumns: string[];
  unknownCustomFields: string[];
  missingRequiredColumns: string[];
  missingRequiredCustomFieldColumns: string[];
  knownCustomFieldHeaders: string[];
};

const stationImportRequiredColumnSet = new Set<string>(stationImportRequiredColumns);
const stationImportOptionalColumnSet = new Set<string>(stationImportOptionalColumns);
const stationImportReadonlyColumnSet = new Set<string>(stationImportReadonlyColumns);

const hasErrorIssues = (issues: StationImportIssue[]) => issues.some((issue) => issue.severity === 'error');

const unique = (values: string[]) => Array.from(new Set(values));

const toIsoString = (value: Date | string | null | undefined): string => {
  if (!value) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
};

export class StationTransferService {
  async exportStationsCsv(userId: string, query: ExportQuery) {
    const filters = { ...query };
    delete filters.page;
    delete filters.limit;

    const rows: StationListItem[] = [];
    const pageSize = 500;
    let page = 1;

    while (true) {
      const result = await stationsService.listFull({
        ...filters,
        page,
        limit: pageSize,
      });

      rows.push(...result.data);

      if (page >= result.meta.totalPages || result.meta.totalPages === 0) {
        break;
      }

      page += 1;
    }

    const definitions = await customFieldsService.listDefinitions();
    const headers = [...stationExportBaseColumns, ...definitions.map((definition) => `${customFieldColumnPrefix}${definition.key}`)];
    const csvRows = rows.map((row) => this.toExportRow(row, definitions));
    const csvContent = serializeCsv(headers, csvRows);
    const fileName = this.buildExportFileName();
    const exportRunId = randomUUID();

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'station_export',
      entityId: exportRunId,
      action: 'station.export_csv',
      metadataJson: {
        fileName,
        filters,
        rowCount: rows.length,
        customFieldCount: definitions.length,
      },
    });

    return {
      fileName,
      csvContent,
    };
  }

  async previewStationsCsvImport(
    userId: string,
    input: {
      fileName: string | null;
      csvContent: string;
    },
  ) {
    const document = parseCsvDocument(input.csvContent);
    const definitions = await customFieldsService.listDefinitions();
    const headerAnalysis = this.analyzeHeaders(document.headers, definitions);
    const parsedRows = document.rows.map((row) => this.parsePreviewCsvRow(row, headerAnalysis, definitions));
    const evaluatedRows = await this.evaluatePreviewRows(parsedRows, headerAnalysis, definitions);
    const summary = this.buildPreviewSummary(evaluatedRows);
    const previewRunId = randomUUID();

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'station_import',
      entityId: previewRunId,
      action: 'station.import_preview',
      metadataJson: {
        fileName: input.fileName,
        totalRows: summary.totalRows,
        validRows: summary.validRows,
        invalidRows: summary.invalidRows,
        createCandidates: summary.createCandidates,
        updateCandidates: summary.updateCandidates,
        skipCandidates: summary.skipCandidates,
        unknownColumns: headerAnalysis.unknownColumns,
        unknownCustomFields: headerAnalysis.unknownCustomFields,
        missingRequiredColumns: headerAnalysis.missingRequiredColumns,
        missingRequiredCustomFieldColumns: headerAnalysis.missingRequiredCustomFieldColumns,
      },
    });

    return {
      fileName: input.fileName,
      headers: headerAnalysis.headers,
      rules: {
        mode: 'upsert' as const,
        matchKey: 'code' as const,
        requiredColumns: [...stationImportRequiredColumns],
        optionalColumns: [...stationImportOptionalColumns],
        readonlyColumns: [...stationImportReadonlyColumns],
        customFieldPrefix: customFieldColumnPrefix,
      },
      columns: {
        unknownColumns: headerAnalysis.unknownColumns,
        unknownCustomFields: headerAnalysis.unknownCustomFields,
        missingRequiredColumns: headerAnalysis.missingRequiredColumns,
        missingRequiredCustomFieldColumns: headerAnalysis.missingRequiredCustomFieldColumns,
      },
      summary,
      rows: evaluatedRows.map((row) => ({
        rowNumber: row.rowNumber,
        status: row.status,
        action: row.action,
        canApply: row.canApply,
        existingStationId: row.existingStationId,
        raw: row.raw,
        issues: row.issues,
        candidate: row.candidate,
      })),
    };
  }

  async applyStationsCsvImport(
    userId: string,
    payload: {
      mode?: 'upsert';
      rows: StationImportApplyRow[];
    },
  ) {
    const mode = payload.mode ?? 'upsert';

    if (mode !== 'upsert') {
      throw new AppError('Unsupported import mode', 400, 'INVALID_IMPORT_MODE');
    }

    if (payload.rows.length === 0) {
      throw new AppError('At least one import row is required', 400, 'INVALID_IMPORT_PAYLOAD');
    }

    const definitions = await customFieldsService.listDefinitions();
    const candidates = payload.rows.map((row) => this.parseApplyRow(row));
    const evaluatedRows = await this.evaluateApplyRows(candidates, definitions);

    const failedRows = evaluatedRows
      .filter((row) => row.status === 'invalid')
      .map((row) => ({
        rowNumber: row.rowNumber,
        code: row.candidate?.station.code ?? row.raw.code ?? null,
        message: this.summarizeIssues(row.issues),
        issues: row.issues,
      }));

    const skippedCount = evaluatedRows.filter((row) => row.status === 'valid' && row.action === 'skip').length;
    const applyableRows = evaluatedRows.filter(
      (row): row is EvaluatedImportRow & { candidate: StationImportApplyRow } =>
        row.status === 'valid' && row.action !== 'skip' && row.candidate !== null,
    );

    let createdCount = 0;
    let updatedCount = 0;
    const importRunId = randomUUID();

    if (applyableRows.length > 0) {
      try {
        await db.transaction(async (tx) => {
          for (const row of applyableRows) {
            const matchedRows = await tx
              .select()
              .from(stations)
              .where(eq(stations.code, row.candidate.station.code));
            const matchedStation = matchedRows[0] ?? null;

            if (!matchedStation) {
              const [created] = await tx
                .insert(stations)
                .values(this.buildInsertValues(userId, row.candidate.station))
                .returning({ id: stations.id });

              if (!created) {
                throw new Error('Failed to create station from import');
              }

              await customFieldsService.upsertStationCustomFieldValues(created.id, row.candidate.customFields ?? {}, tx, {
                enforceRequiredDefinitions: true,
              });

              await writeAuditLog(
                {
                  actorUserId: userId,
                  entityType: 'station',
                  entityId: created.id,
                  action: 'station.created',
                  metadataJson: {
                    source: 'csv_import',
                    importRunId,
                    rowNumber: row.rowNumber,
                  },
                },
                tx,
              );

              createdCount += 1;
              continue;
            }

            const [updated] = await tx
              .update(stations)
              .set(this.buildUpdateValues(userId, row.candidate.station, matchedStation))
              .where(eq(stations.id, matchedStation.id))
              .returning({ id: stations.id });

            if (!updated) {
              throw new AppError('Station not found during import apply', 404, 'STATION_NOT_FOUND');
            }

            if (row.candidate.customFields) {
              await customFieldsService.upsertStationCustomFieldValues(updated.id, row.candidate.customFields, tx);
            }

            await writeAuditLog(
              {
                actorUserId: userId,
                entityType: 'station',
                entityId: updated.id,
                action: 'station.updated',
                metadataJson: {
                  source: 'csv_import',
                  importRunId,
                  rowNumber: row.rowNumber,
                },
              },
              tx,
            );

            updatedCount += 1;
          }

          await writeAuditLog(
            {
              actorUserId: userId,
              entityType: 'station_import',
              entityId: importRunId,
              action: 'station.import_apply',
              metadataJson: {
                mode,
                totalRows: payload.rows.length,
                createdCount,
                updatedCount,
                skippedCount,
                failedRowCount: failedRows.length,
              },
            },
            tx,
          );
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new AppError(
            'Station import failed because unique station fields changed during apply. Re-run preview and try again.',
            409,
            'IMPORT_CONFLICT',
          );
        }

        throw error;
      }
    } else {
      await writeAuditLog({
        actorUserId: userId,
        entityType: 'station_import',
        entityId: importRunId,
        action: 'station.import_apply',
        metadataJson: {
          mode,
          totalRows: payload.rows.length,
          createdCount: 0,
          updatedCount: 0,
          skippedCount,
          failedRowCount: failedRows.length,
        },
      });
    }

    return {
      mode,
      totalRows: payload.rows.length,
      createdCount,
      updatedCount,
      skippedCount,
      failedRows,
    };
  }

  private analyzeHeaders(headers: string[], definitions: CustomFieldDefinition[]): FileHeaderAnalysis {
    const definitionKeys = new Set(definitions.map((definition) => definition.key));
    const headerSet = new Set(headers);
    const unknownColumns: string[] = [];
    const unknownCustomFields: string[] = [];
    const knownCustomFieldHeaders: string[] = [];

    for (const header of headers) {
      if (
        stationImportRequiredColumnSet.has(header) ||
        stationImportOptionalColumnSet.has(header) ||
        stationImportReadonlyColumnSet.has(header)
      ) {
        continue;
      }

      if (!header.startsWith(customFieldColumnPrefix)) {
        unknownColumns.push(header);
        continue;
      }

      const fieldKey = header.slice(customFieldColumnPrefix.length).trim();

      if (!fieldKey || !definitionKeys.has(fieldKey)) {
        unknownCustomFields.push(header);
        continue;
      }

      knownCustomFieldHeaders.push(header);
    }

    const missingRequiredColumns = stationImportRequiredColumns.filter((column) => !headerSet.has(column));
    const missingRequiredCustomFieldColumns = definitions
      .filter((definition) => definition.isRequired)
      .map((definition) => `${customFieldColumnPrefix}${definition.key}`)
      .filter((column) => !headerSet.has(column));

    return {
      headers,
      headerSet,
      unknownColumns,
      unknownCustomFields,
      missingRequiredColumns,
      missingRequiredCustomFieldColumns,
      knownCustomFieldHeaders,
    };
  }

  private parsePreviewCsvRow(
    row: ParsedCsvRow,
    headerAnalysis: FileHeaderAnalysis,
    definitions: CustomFieldDefinition[],
  ): PreviewCandidateRow {
    const definitionMap = new Map(definitions.map((definition) => [definition.key, definition]));
    const issues: StationImportIssue[] = [];
    const station: Partial<StationImportStationInput> = {};

    station.name = this.normalizeTextValue(row.values.name ?? '', 'name', issues, { minLength: 2, maxLength: 160, required: true });
    station.code = this.normalizeTextValue(row.values.code ?? '', 'code', issues, { minLength: 2, maxLength: 80, required: true });
    station.qrCode = this.normalizeTextValue(row.values.qrCode ?? '', 'qrCode', issues, { minLength: 2, maxLength: 150, required: true });
    station.brand = this.normalizeTextValue(row.values.brand ?? '', 'brand', issues, { minLength: 1, maxLength: 120, required: true });
    station.model = this.normalizeTextValue(row.values.model ?? '', 'model', issues, { minLength: 1, maxLength: 120, required: true });
    station.serialNumber = this.normalizeTextValue(row.values.serialNumber ?? '', 'serialNumber', issues, {
      minLength: 2,
      maxLength: 150,
      required: true,
    });
    station.location = this.normalizeTextValue(row.values.location ?? '', 'location', issues, {
      minLength: 2,
      required: true,
    });

    const powerKw = this.normalizeNumberValue(row.values.powerKw ?? '', 'powerKw', issues, { minimum: 0, required: true });

    if (powerKw !== undefined) {
      station.powerKw = powerKw;
    }

    const currentType = this.normalizeCurrentType(row.values.currentType ?? '', issues);

    if (currentType) {
      station.currentType = currentType;
    }

    const socketType = this.normalizeSocketType(row.values.socketType ?? '', issues);

    if (socketType) {
      station.socketType = socketType;
    }

    const status = this.normalizeStatus(row.values.status ?? '', issues);

    if (status) {
      station.status = status;
    }

    const isArchived = this.normalizeBooleanString(row.values.isArchived ?? '', 'isArchived', issues);

    if (isArchived !== undefined) {
      station.isArchived = isArchived;
    }

    const lastTestDate = this.normalizeOptionalDate(row.values.lastTestDate ?? '', 'lastTestDate', issues);

    if (lastTestDate) {
      station.lastTestDate = lastTestDate;
    }

    const notes = this.normalizeOptionalText(row.values.notes ?? '');

    if (notes) {
      station.notes = notes;
    }

    this.validateLifecycleInput(station, issues);

    const customFields: Record<string, unknown> = {};

    for (const header of headerAnalysis.knownCustomFieldHeaders) {
      const definitionKey = header.slice(customFieldColumnPrefix.length);
      const definition = definitionMap.get(definitionKey);
      const rawValue = row.values[header] ?? '';

      if (!definition) {
        continue;
      }

      const parsed = this.parseCsvCustomFieldValue(definition, rawValue, issues, header);

      if (parsed.hasValue) {
        customFields[definition.key] = parsed.value;
      }
    }

    for (const unknownHeader of headerAnalysis.unknownCustomFields) {
      const rawValue = row.values[unknownHeader] ?? '';

      if (rawValue.trim() === '') {
        continue;
      }

      issues.push({
        severity: 'error',
        code: 'UNKNOWN_CUSTOM_FIELD',
        message: `Unknown custom field column: ${unknownHeader}`,
        field: unknownHeader,
        value: rawValue,
      });
    }

    return {
      rowNumber: row.rowNumber,
      raw: row.values,
      station,
      customFields,
      issues,
    };
  }

  private parseApplyRow(row: StationImportApplyRow): PreviewCandidateRow {
    const issues: StationImportIssue[] = [];
    const station: Partial<StationImportStationInput> = {};

    station.name = this.normalizeTextValue(row.station.name, 'name', issues, { minLength: 2, maxLength: 160, required: true });
    station.code = this.normalizeTextValue(row.station.code, 'code', issues, { minLength: 2, maxLength: 80, required: true });
    station.qrCode = this.normalizeTextValue(row.station.qrCode, 'qrCode', issues, { minLength: 2, maxLength: 150, required: true });
    station.brand = this.normalizeTextValue(row.station.brand, 'brand', issues, { minLength: 1, maxLength: 120, required: true });
    station.model = this.normalizeTextValue(row.station.model, 'model', issues, { minLength: 1, maxLength: 120, required: true });
    station.serialNumber = this.normalizeTextValue(row.station.serialNumber, 'serialNumber', issues, {
      minLength: 2,
      maxLength: 150,
      required: true,
    });
    station.location = this.normalizeTextValue(row.station.location, 'location', issues, {
      minLength: 2,
      required: true,
    });

    const powerKw = this.normalizeNumberLiteral(row.station.powerKw, 'powerKw', issues, { minimum: 0 });

    if (powerKw !== undefined) {
      station.powerKw = powerKw;
    }

    if (stationCurrentTypeValues.includes(row.station.currentType)) {
      station.currentType = row.station.currentType;
    } else {
      issues.push({
        severity: 'error',
        code: 'INVALID_CURRENT_TYPE',
        message: `currentType must be one of: ${stationCurrentTypeValues.join(', ')}`,
        field: 'currentType',
        value: String(row.station.currentType),
      });
    }

    if (stationSocketTypeValues.includes(row.station.socketType)) {
      station.socketType = row.station.socketType;
    } else {
      issues.push({
        severity: 'error',
        code: 'INVALID_SOCKET_TYPE',
        message: `socketType must be one of: ${stationSocketTypeValues.join(', ')}`,
        field: 'socketType',
        value: String(row.station.socketType),
      });
    }

    if (row.station.status) {
      if (stationStatusValues.includes(row.station.status)) {
        station.status = row.station.status;
      } else {
        issues.push({
          severity: 'error',
          code: 'INVALID_STATUS',
          message: `status must be one of: ${stationStatusValues.join(', ')}`,
          field: 'status',
          value: String(row.station.status),
        });
      }
    }

    if (typeof row.station.isArchived === 'boolean') {
      station.isArchived = row.station.isArchived;
    }

    if (row.station.lastTestDate) {
      const normalizedDate = this.normalizeOptionalDate(row.station.lastTestDate, 'lastTestDate', issues);

      if (normalizedDate) {
        station.lastTestDate = normalizedDate;
      }
    }

    if (row.station.notes) {
      const normalizedNotes = this.normalizeOptionalText(row.station.notes);

      if (normalizedNotes) {
        station.notes = normalizedNotes;
      }
    }

    this.validateLifecycleInput(station, issues);

    return {
      rowNumber: row.rowNumber,
      raw: {
        code: row.station.code,
        qrCode: row.station.qrCode,
        serialNumber: row.station.serialNumber,
      },
      station,
      customFields: row.customFields ?? {},
      issues,
    };
  }

  private async evaluatePreviewRows(
    candidates: PreviewCandidateRow[],
    headerAnalysis: FileHeaderAnalysis,
    definitions: CustomFieldDefinition[],
  ): Promise<EvaluatedImportRow[]> {
    const duplicateRowsByCode = this.buildDuplicateMap(candidates, (row) => row.station.code);
    const duplicateRowsByQrCode = this.buildDuplicateMap(candidates, (row) => row.station.qrCode);
    const duplicateRowsBySerialNumber = this.buildDuplicateMap(candidates, (row) => row.station.serialNumber);
    const stationLookups = await this.loadExistingStationContext(candidates);

    return candidates.map((candidate) =>
      this.evaluateCandidateRow(candidate, {
        headerAnalysis,
        definitions,
        duplicateRowsByCode,
        duplicateRowsByQrCode,
        duplicateRowsBySerialNumber,
        ...stationLookups,
      }),
    );
  }

  private async evaluateApplyRows(
    candidates: PreviewCandidateRow[],
    definitions: CustomFieldDefinition[],
  ): Promise<EvaluatedImportRow[]> {
    const duplicateRowsByCode = this.buildDuplicateMap(candidates, (row) => row.station.code);
    const duplicateRowsByQrCode = this.buildDuplicateMap(candidates, (row) => row.station.qrCode);
    const duplicateRowsBySerialNumber = this.buildDuplicateMap(candidates, (row) => row.station.serialNumber);
    const stationLookups = await this.loadExistingStationContext(candidates);
    const headerAnalysis: FileHeaderAnalysis = {
      headers: [],
      headerSet: new Set<string>(),
      unknownColumns: [],
      unknownCustomFields: [],
      missingRequiredColumns: [],
      missingRequiredCustomFieldColumns: [],
      knownCustomFieldHeaders: [],
    };

    return candidates.map((candidate) =>
      this.evaluateCandidateRow(candidate, {
        headerAnalysis,
        definitions,
        duplicateRowsByCode,
        duplicateRowsByQrCode,
        duplicateRowsBySerialNumber,
        ...stationLookups,
      }),
    );
  }

  private async loadExistingStationContext(candidates: PreviewCandidateRow[]) {
    const codes = unique(
      candidates
        .map((candidate) => candidate.station.code)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    );
    const qrCodes = unique(
      candidates
        .map((candidate) => candidate.station.qrCode)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    );
    const serialNumbers = unique(
      candidates
        .map((candidate) => candidate.station.serialNumber)
        .filter((value): value is string => typeof value === 'string' && value.length > 0),
    );
    const existingStations = await stationsRepository.findByUniqueFields({
      codes,
      qrCodes,
      serialNumbers,
    });
    const existingStationIds = existingStations.map((station) => station.id);
    const existingCustomFieldMap =
      existingStationIds.length > 0 ? await customFieldsService.getStationCustomFieldMap(existingStationIds) : new Map();

    return {
      existingByCode: new Map(existingStations.map((station) => [station.code, station])),
      existingByQrCode: new Map(existingStations.map((station) => [station.qrCode, station])),
      existingBySerialNumber: new Map(existingStations.map((station) => [station.serialNumber, station])),
      existingCustomFieldMap,
    };
  }

  private evaluateCandidateRow(
    candidate: PreviewCandidateRow,
    context: {
      headerAnalysis: FileHeaderAnalysis;
      definitions: CustomFieldDefinition[];
      duplicateRowsByCode: Map<string, number[]>;
      duplicateRowsByQrCode: Map<string, number[]>;
      duplicateRowsBySerialNumber: Map<string, number[]>;
      existingByCode: Map<string, ExistingStation>;
      existingByQrCode: Map<string, ExistingStation>;
      existingBySerialNumber: Map<string, ExistingStation>;
      existingCustomFieldMap: Map<string, Record<string, unknown>>;
    },
  ): EvaluatedImportRow {
    const issues = [...candidate.issues];

    if (context.headerAnalysis.unknownColumns.length > 0) {
      issues.push({
        severity: 'error',
        code: 'UNSUPPORTED_COLUMNS',
        message: `Unsupported CSV columns: ${context.headerAnalysis.unknownColumns.join(', ')}`,
        field: null,
      });
    }

    if (context.headerAnalysis.missingRequiredColumns.length > 0) {
      issues.push({
        severity: 'error',
        code: 'MISSING_REQUIRED_COLUMNS',
        message: `Missing required CSV columns: ${context.headerAnalysis.missingRequiredColumns.join(', ')}`,
        field: null,
      });
    }

    const station = this.isCompleteStation(candidate.station) ? candidate.station : null;
    const existingStation = station ? context.existingByCode.get(station.code) ?? null : null;

    if (station) {
      this.pushDuplicateIssues('code', station.code, candidate.rowNumber, context.duplicateRowsByCode, issues);
      this.pushDuplicateIssues('qrCode', station.qrCode, candidate.rowNumber, context.duplicateRowsByQrCode, issues);
      this.pushDuplicateIssues(
        'serialNumber',
        station.serialNumber,
        candidate.rowNumber,
        context.duplicateRowsBySerialNumber,
        issues,
      );

      this.pushDatabaseDuplicateIssues(station, existingStation, context.existingByQrCode, context.existingBySerialNumber, issues);

      const normalizedCustomFields = this.validateStructuredCustomFields(
        candidate.customFields,
        context.definitions,
        issues,
      );

      if (!existingStation) {
        const missingRequiredCustomFields = context.definitions
          .filter((definition) => definition.isRequired)
          .map((definition) => definition.key)
          .filter((key) => !(key in normalizedCustomFields));

        if (missingRequiredCustomFields.length > 0) {
          issues.push({
            severity: 'error',
            code: 'MISSING_REQUIRED_CUSTOM_FIELDS',
            message: `Missing required custom field values for create rows: ${missingRequiredCustomFields.join(', ')}`,
            field: null,
          });
        }
      }

      const action = this.resolveRowAction(station, normalizedCustomFields, existingStation, context.existingCustomFieldMap);
      const status = hasErrorIssues(issues) ? 'invalid' : 'valid';

      return {
        rowNumber: candidate.rowNumber,
        raw: candidate.raw,
        issues,
        status,
        action: status === 'valid' ? action : 'skip',
        canApply: status === 'valid' && action !== 'skip',
        existingStationId: existingStation?.id ?? null,
        candidate:
          status === 'valid'
            ? {
                rowNumber: candidate.rowNumber,
                station,
                ...(Object.keys(normalizedCustomFields).length > 0 ? { customFields: normalizedCustomFields } : {}),
              }
            : null,
      };
    }

    return {
      rowNumber: candidate.rowNumber,
      raw: candidate.raw,
      issues,
      status: 'invalid',
      action: 'skip',
      canApply: false,
      existingStationId: null,
      candidate: null,
    };
  }

  private validateStructuredCustomFields(
    customFields: Record<string, unknown>,
    definitions: CustomFieldDefinition[],
    issues: StationImportIssue[],
  ) {
    const definitionMap = new Map(definitions.map((definition) => [definition.key, definition]));
    const normalizedCustomFields: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(customFields)) {
      const definition = definitionMap.get(key);

      if (!definition) {
        issues.push({
          severity: 'error',
          code: 'UNKNOWN_CUSTOM_FIELD',
          message: `Unknown custom field key: ${key}`,
          field: `${customFieldColumnPrefix}${key}`,
        });
        continue;
      }

      const normalized = this.normalizeApplyCustomFieldValue(definition, value, issues);

      if (normalized.hasValue) {
        normalizedCustomFields[key] = normalized.value;
      }
    }

    return normalizedCustomFields;
  }

  private resolveRowAction(
    station: StationImportStationInput,
    customFields: Record<string, unknown>,
    existingStation: ExistingStation | null,
    existingCustomFieldMap: Map<string, Record<string, unknown>>,
  ): StationCsvAction {
    if (!existingStation) {
      return 'create';
    }

    const lifecycle = this.resolveLifecycle(station, existingStation);
    const existingCustomFields = existingCustomFieldMap.get(existingStation.id) ?? {};

    if (existingStation.name !== station.name) {
      return 'update';
    }

    if (existingStation.code !== station.code) {
      return 'update';
    }

    if (existingStation.qrCode !== station.qrCode) {
      return 'update';
    }

    if (existingStation.brand !== station.brand) {
      return 'update';
    }

    if (existingStation.model !== station.model) {
      return 'update';
    }

    if (existingStation.serialNumber !== station.serialNumber) {
      return 'update';
    }

    if (Number(existingStation.powerKw) !== station.powerKw) {
      return 'update';
    }

    if (existingStation.currentType !== station.currentType) {
      return 'update';
    }

    if (existingStation.socketType !== station.socketType) {
      return 'update';
    }

    if (existingStation.location !== station.location) {
      return 'update';
    }

    if (existingStation.status !== lifecycle.status || existingStation.isArchived !== lifecycle.isArchived) {
      return 'update';
    }

    if (station.lastTestDate && toIsoString(existingStation.lastTestDate) !== station.lastTestDate) {
      return 'update';
    }

    if (station.notes && (existingStation.notes ?? '') !== station.notes) {
      return 'update';
    }

    for (const [key, value] of Object.entries(customFields)) {
      if (!isDeepStrictEqual(existingCustomFields[key], value)) {
        return 'update';
      }
    }

    return 'skip';
  }

  private pushDuplicateIssues(
    field: 'code' | 'qrCode' | 'serialNumber',
    value: string,
    rowNumber: number,
    duplicateRows: Map<string, number[]>,
    issues: StationImportIssue[],
  ) {
    const relatedRows = duplicateRows.get(value);

    if (!relatedRows || relatedRows.length <= 1) {
      return;
    }

    issues.push({
      severity: 'error',
      code: `DUPLICATE_${field.toUpperCase()}_IN_FILE`,
      message: `${field} is duplicated in the uploaded CSV`,
      field,
      value,
      relatedRowNumbers: relatedRows.filter((relatedRow) => relatedRow !== rowNumber),
    });
  }

  private pushDatabaseDuplicateIssues(
    station: StationImportStationInput,
    existingStation: ExistingStation | null,
    existingByQrCode: Map<string, ExistingStation>,
    existingBySerialNumber: Map<string, ExistingStation>,
    issues: StationImportIssue[],
  ) {
    const qrCodeMatch = existingByQrCode.get(station.qrCode);

    if (qrCodeMatch && qrCodeMatch.id !== existingStation?.id) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_QR_CODE',
        message: 'qrCode already belongs to a different station',
        field: 'qrCode',
        value: station.qrCode,
        existingStationId: qrCodeMatch.id,
      });
    }

    const serialMatch = existingBySerialNumber.get(station.serialNumber);

    if (serialMatch && serialMatch.id !== existingStation?.id) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_SERIAL_NUMBER',
        message: 'serialNumber already belongs to a different station',
        field: 'serialNumber',
        value: station.serialNumber,
        existingStationId: serialMatch.id,
      });
    }
  }

  private buildDuplicateMap(
    rows: PreviewCandidateRow[],
    selector: (row: PreviewCandidateRow) => string | undefined,
  ): Map<string, number[]> {
    const duplicateMap = new Map<string, number[]>();

    for (const row of rows) {
      const value = selector(row)?.trim();

      if (!value) {
        continue;
      }

      const relatedRows = duplicateMap.get(value) ?? [];
      relatedRows.push(row.rowNumber);
      duplicateMap.set(value, relatedRows);
    }

    for (const [value, rowNumbers] of Array.from(duplicateMap.entries())) {
      if (rowNumbers.length <= 1) {
        duplicateMap.delete(value);
      }
    }

    return duplicateMap;
  }

  private normalizeTextValue(
    rawValue: string,
    field: string,
    issues: StationImportIssue[],
    options: {
      required?: boolean;
      minLength?: number;
      maxLength?: number;
    },
  ) {
    const value = rawValue.trim();

    if (!value) {
      if (options.required) {
        issues.push({
          severity: 'error',
          code: 'REQUIRED_VALUE',
          message: `${field} is required`,
          field,
        });
      }

      return undefined;
    }

    if (options.minLength && value.length < options.minLength) {
      issues.push({
        severity: 'error',
        code: 'VALUE_TOO_SHORT',
        message: `${field} must be at least ${options.minLength} characters`,
        field,
        value,
      });
      return undefined;
    }

    if (options.maxLength && value.length > options.maxLength) {
      issues.push({
        severity: 'error',
        code: 'VALUE_TOO_LONG',
        message: `${field} must be at most ${options.maxLength} characters`,
        field,
        value,
      });
      return undefined;
    }

    return value;
  }

  private normalizeOptionalText(rawValue: string) {
    const value = rawValue.trim();
    return value || undefined;
  }

  private normalizeNumberValue(
    rawValue: string,
    field: string,
    issues: StationImportIssue[],
    options: {
      required?: boolean;
      minimum?: number;
    },
  ) {
    const value = rawValue.trim();

    if (!value) {
      if (options.required) {
        issues.push({
          severity: 'error',
          code: 'REQUIRED_VALUE',
          message: `${field} is required`,
          field,
        });
      }

      return undefined;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_NUMBER',
        message: `${field} must be a valid number`,
        field,
        value,
      });
      return undefined;
    }

    if (options.minimum !== undefined && parsed < options.minimum) {
      issues.push({
        severity: 'error',
        code: 'INVALID_NUMBER_RANGE',
        message: `${field} must be greater than or equal to ${options.minimum}`,
        field,
        value,
      });
      return undefined;
    }

    return parsed;
  }

  private normalizeNumberLiteral(
    value: number,
    field: string,
    issues: StationImportIssue[],
    options: {
      minimum?: number;
    },
  ) {
    if (!Number.isFinite(value)) {
      issues.push({
        severity: 'error',
        code: 'INVALID_NUMBER',
        message: `${field} must be a valid number`,
        field,
        value: String(value),
      });
      return undefined;
    }

    if (options.minimum !== undefined && value < options.minimum) {
      issues.push({
        severity: 'error',
        code: 'INVALID_NUMBER_RANGE',
        message: `${field} must be greater than or equal to ${options.minimum}`,
        field,
        value: String(value),
      });
      return undefined;
    }

    return value;
  }

  private normalizeCurrentType(rawValue: string, issues: StationImportIssue[]) {
    const normalized = rawValue.trim().toUpperCase();

    if (!normalized) {
      issues.push({
        severity: 'error',
        code: 'REQUIRED_VALUE',
        message: 'currentType is required',
        field: 'currentType',
      });
      return undefined;
    }

    if (normalized === 'AC' || normalized === 'DC') {
      return normalized as CurrentType;
    }

    issues.push({
      severity: 'error',
      code: 'INVALID_CURRENT_TYPE',
      message: `currentType must be one of: ${stationCurrentTypeValues.join(', ')}`,
      field: 'currentType',
      value: rawValue,
    });

    return undefined;
  }

  private normalizeSocketType(rawValue: string, issues: StationImportIssue[]) {
    const normalized = rawValue.trim().toLowerCase();

    if (!normalized) {
      issues.push({
        severity: 'error',
        code: 'REQUIRED_VALUE',
        message: 'socketType is required',
        field: 'socketType',
      });
      return undefined;
    }

    const matched = stationSocketTypeValues.find((value) => value.toLowerCase() === normalized);

    if (matched) {
      return matched;
    }

    issues.push({
      severity: 'error',
      code: 'INVALID_SOCKET_TYPE',
      message: `socketType must be one of: ${stationSocketTypeValues.join(', ')}`,
      field: 'socketType',
      value: rawValue,
    });

    return undefined;
  }

  private normalizeStatus(rawValue: string, issues: StationImportIssue[]) {
    const normalized = rawValue.trim().toLowerCase();

    if (!normalized) {
      return undefined;
    }

    const matched = stationStatusValues.find((value: StationStatus) => value === normalized);

    if (matched) {
      return matched;
    }

    issues.push({
      severity: 'error',
      code: 'INVALID_STATUS',
      message: `status must be one of: ${stationStatusValues.join(', ')}`,
      field: 'status',
      value: rawValue,
    });

    return undefined;
  }

  private normalizeBooleanString(rawValue: string, field: string, issues: StationImportIssue[]) {
    const normalized = rawValue.trim().toLowerCase();

    if (!normalized) {
      return undefined;
    }

    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }

    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }

    issues.push({
      severity: 'error',
      code: 'INVALID_BOOLEAN',
      message: `${field} must be a boolean value`,
      field,
      value: rawValue,
    });

    return undefined;
  }

  private normalizeOptionalDate(rawValue: string, field: string, issues: StationImportIssue[]) {
    const value = rawValue.trim();

    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      issues.push({
        severity: 'error',
        code: 'INVALID_DATE',
        message: `${field} must be a valid date`,
        field,
        value: rawValue,
      });
      return undefined;
    }

    return parsed.toISOString();
  }

  private parseCsvCustomFieldValue(
    definition: CustomFieldDefinition,
    rawValue: string,
    issues: StationImportIssue[],
    field: string,
  ) {
    const value = rawValue.trim();

    if (!value) {
      return {
        hasValue: false,
      };
    }

    switch (definition.type) {
      case 'text':
        return {
          hasValue: true,
          value,
        };
      case 'number': {
        const parsed = Number(value);

        if (!Number.isFinite(parsed)) {
          issues.push({
            severity: 'error',
            code: 'INVALID_CUSTOM_FIELD_VALUE',
            message: `${definition.key} must be a valid number`,
            field,
            value,
          });

          return { hasValue: false };
        }

        return {
          hasValue: true,
          value: parsed,
        };
      }
      case 'boolean': {
        const parsed = this.normalizeBooleanString(value, field, issues);

        if (parsed === undefined) {
          return { hasValue: false };
        }

        return {
          hasValue: true,
          value: parsed,
        };
      }
      case 'select': {
        const options = this.extractSelectOptions(definition);

        if (options.length > 0 && !options.includes(value)) {
          issues.push({
            severity: 'error',
            code: 'INVALID_CUSTOM_FIELD_OPTION',
            message: `${definition.key} must be one of: ${options.join(', ')}`,
            field,
            value,
          });

          return { hasValue: false };
        }

        return {
          hasValue: true,
          value,
        };
      }
      case 'date': {
        const normalizedDate = this.normalizeOptionalDate(value, field, issues);

        if (!normalizedDate) {
          return { hasValue: false };
        }

        return {
          hasValue: true,
          value: normalizedDate,
        };
      }
      case 'json': {
        try {
          return {
            hasValue: true,
            value: JSON.parse(value),
          };
        } catch {
          issues.push({
            severity: 'error',
            code: 'INVALID_CUSTOM_FIELD_JSON',
            message: `${definition.key} must be valid JSON`,
            field,
            value,
          });

          return { hasValue: false };
        }
      }
      default:
        issues.push({
          severity: 'error',
          code: 'INVALID_CUSTOM_FIELD_TYPE',
          message: `Unsupported custom field type for ${definition.key}`,
          field,
        });

        return { hasValue: false };
    }
  }

  private normalizeApplyCustomFieldValue(
    definition: CustomFieldDefinition,
    value: unknown,
    issues: StationImportIssue[],
  ) {
    if (value === undefined || value === null || value === '') {
      return {
        hasValue: false,
      };
    }

    switch (definition.type) {
      case 'text':
        if (typeof value !== 'string') {
          issues.push({
            severity: 'error',
            code: 'INVALID_CUSTOM_FIELD_VALUE',
            message: `${definition.key} must be text`,
            field: `${customFieldColumnPrefix}${definition.key}`,
          });
          return { hasValue: false };
        }

        if (!value.trim()) {
          return { hasValue: false };
        }

        return {
          hasValue: true,
          value: value.trim(),
        };
      case 'number':
        if (typeof value !== 'number' || Number.isNaN(value)) {
          issues.push({
            severity: 'error',
            code: 'INVALID_CUSTOM_FIELD_VALUE',
            message: `${definition.key} must be a number`,
            field: `${customFieldColumnPrefix}${definition.key}`,
          });
          return { hasValue: false };
        }

        return {
          hasValue: true,
          value,
        };
      case 'boolean':
        if (typeof value !== 'boolean') {
          issues.push({
            severity: 'error',
            code: 'INVALID_CUSTOM_FIELD_VALUE',
            message: `${definition.key} must be boolean`,
            field: `${customFieldColumnPrefix}${definition.key}`,
          });
          return { hasValue: false };
        }

        return {
          hasValue: true,
          value,
        };
      case 'select': {
        if (typeof value !== 'string') {
          issues.push({
            severity: 'error',
            code: 'INVALID_CUSTOM_FIELD_VALUE',
            message: `${definition.key} must be text`,
            field: `${customFieldColumnPrefix}${definition.key}`,
          });
          return { hasValue: false };
        }

        const normalizedValue = value.trim();

        if (!normalizedValue) {
          return { hasValue: false };
        }

        const options = this.extractSelectOptions(definition);

        if (options.length > 0 && !options.includes(normalizedValue)) {
          issues.push({
            severity: 'error',
            code: 'INVALID_CUSTOM_FIELD_OPTION',
            message: `${definition.key} must be one of: ${options.join(', ')}`,
            field: `${customFieldColumnPrefix}${definition.key}`,
          });
          return { hasValue: false };
        }

        return {
          hasValue: true,
          value: normalizedValue,
        };
      }
      case 'date':
        if (typeof value !== 'string') {
          issues.push({
            severity: 'error',
            code: 'INVALID_CUSTOM_FIELD_VALUE',
            message: `${definition.key} must be a valid date string`,
            field: `${customFieldColumnPrefix}${definition.key}`,
          });
          return { hasValue: false };
        }

        if (!value.trim()) {
          return { hasValue: false };
        }

        const normalizedDate = this.normalizeOptionalDate(value, `${customFieldColumnPrefix}${definition.key}`, issues);

        if (!normalizedDate) {
          return { hasValue: false };
        }

        return {
          hasValue: true,
          value: normalizedDate,
        };
      case 'json':
        return {
          hasValue: true,
          value,
        };
      default:
        issues.push({
          severity: 'error',
          code: 'INVALID_CUSTOM_FIELD_TYPE',
          message: `Unsupported custom field type for ${definition.key}`,
          field: `${customFieldColumnPrefix}${definition.key}`,
        });
        return { hasValue: false };
    }
  }

  private extractSelectOptions(definition: CustomFieldDefinition) {
    const options = definition.optionsJson.options;

    if (!Array.isArray(options)) {
      return [];
    }

    return options.filter((option): option is string => typeof option === 'string');
  }

  private validateLifecycleInput(station: Partial<StationImportStationInput>, issues: StationImportIssue[]) {
    if (station.status === undefined || station.isArchived === undefined) {
      return;
    }

    if (station.isArchived === true && station.status !== 'inactive') {
      issues.push({
        severity: 'error',
        code: 'ARCHIVE_STATE_CONFLICT',
        message: 'Archived stations must use status=inactive',
        field: 'isArchived',
      });
    }
  }

  private resolveLifecycle(station: StationImportStationInput, existingStation?: ExistingStation | null) {
    const isArchived = station.isArchived ?? existingStation?.isArchived ?? false;

    if (isArchived) {
      return {
        status: 'inactive' as const,
        isArchived: true,
      };
    }

    return {
      status: station.status ?? existingStation?.status ?? ('active' as const),
      isArchived: false,
    };
  }

  private isCompleteStation(station: Partial<StationImportStationInput>): station is StationImportStationInput {
    return (
      typeof station.name === 'string' &&
      typeof station.code === 'string' &&
      typeof station.qrCode === 'string' &&
      typeof station.brand === 'string' &&
      typeof station.model === 'string' &&
      typeof station.serialNumber === 'string' &&
      typeof station.powerKw === 'number' &&
      typeof station.currentType === 'string' &&
      typeof station.socketType === 'string' &&
      typeof station.location === 'string'
    );
  }

  private buildPreviewSummary(rows: EvaluatedImportRow[]) {
    const totalRows = rows.length;
    const validRows = rows.filter((row) => row.status === 'valid').length;
    const invalidRows = totalRows - validRows;
    const createCandidates = rows.filter((row) => row.status === 'valid' && row.action === 'create').length;
    const updateCandidates = rows.filter((row) => row.status === 'valid' && row.action === 'update').length;
    const skipCandidates = rows.filter((row) => row.status === 'valid' && row.action === 'skip').length;

    return {
      totalRows,
      validRows,
      invalidRows,
      createCandidates,
      updateCandidates,
      skipCandidates,
    };
  }

  private summarizeIssues(issues: StationImportIssue[]) {
    return issues.map((issue) => issue.message).join('; ');
  }

  private toExportRow(row: StationListItem, definitions: CustomFieldDefinition[]) {
    const exportRow: Record<string, unknown> = {
      name: row.name,
      code: row.code,
      qrCode: row.qrCode,
      brand: row.brand,
      model: row.model,
      serialNumber: row.serialNumber,
      powerKw: row.powerKw,
      currentType: row.currentType,
      socketType: row.socketType,
      location: row.location,
      status: row.status,
      isArchived: row.isArchived,
      lastTestDate: toIsoString(row.lastTestDate),
      notes: row.notes ?? '',
      archivedAt: toIsoString(row.archivedAt),
      createdAt: toIsoString(row.createdAt),
      updatedAt: toIsoString(row.updatedAt),
    };

    for (const definition of definitions) {
      exportRow[`${customFieldColumnPrefix}${definition.key}`] = row.customFields[definition.key];
    }

    return exportRow;
  }

  private buildExportFileName() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `stations-export-${timestamp}.csv`;
  }

  private buildInsertValues(userId: string, station: StationImportStationInput) {
    const lifecycle = this.resolveLifecycle(station);

    return {
      name: station.name,
      code: station.code,
      qrCode: station.qrCode,
      brand: station.brand,
      model: station.model,
      serialNumber: station.serialNumber,
      powerKw: station.powerKw.toString(),
      currentType: station.currentType,
      socketType: station.socketType,
      location: station.location,
      status: lifecycle.status,
      isArchived: lifecycle.isArchived,
      archivedAt: lifecycle.isArchived ? new Date() : undefined,
      lastTestDate: station.lastTestDate ? new Date(station.lastTestDate) : undefined,
      notes: station.notes,
      createdBy: userId,
      updatedBy: userId,
    };
  }

  private buildUpdateValues(userId: string, station: StationImportStationInput, existingStation: ExistingStation) {
    const lifecycle = this.resolveLifecycle(station, existingStation);

    return {
      name: station.name,
      code: station.code,
      qrCode: station.qrCode,
      brand: station.brand,
      model: station.model,
      serialNumber: station.serialNumber,
      powerKw: station.powerKw.toString(),
      currentType: station.currentType,
      socketType: station.socketType,
      location: station.location,
      status: lifecycle.status,
      isArchived: lifecycle.isArchived,
      archivedAt: lifecycle.isArchived ? existingStation.archivedAt ?? new Date() : null,
      lastTestDate: station.lastTestDate ? new Date(station.lastTestDate) : undefined,
      notes: station.notes,
      updatedBy: userId,
      updatedAt: new Date(),
    };
  }
}

export const stationTransferService = new StationTransferService();
