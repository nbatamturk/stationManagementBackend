import { parse } from 'csv-parse/sync';

import { AppError } from '../../utils/errors';

export type ParsedCsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type ParsedCsvDocument = {
  headers: string[];
  rows: ParsedCsvRow[];
};

const normalizeHeader = (value: unknown) => String(value ?? '').trim();
const normalizeCell = (value: unknown) => String(value ?? '');

export const parseCsvDocument = (csvContent: string): ParsedCsvDocument => {
  if (!csvContent.trim()) {
    throw new AppError('CSV file is empty', 400, 'INVALID_CSV');
  }

  let records: unknown[][];

  try {
    records = parse(csvContent, {
      bom: true,
      relax_column_count: false,
      skip_empty_lines: false,
    }) as unknown[][];
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to parse CSV';
    throw new AppError(`Malformed CSV: ${message}`, 400, 'INVALID_CSV');
  }

  if (records.length === 0) {
    throw new AppError('CSV file does not contain a header row', 400, 'INVALID_CSV');
  }

  const [headerRow, ...dataRows] = records;
  const headers = (headerRow ?? []).map(normalizeHeader);

  if (headers.length === 0 || headers.every((header) => !header)) {
    throw new AppError('CSV header row is empty', 400, 'INVALID_CSV');
  }

  const seenHeaders = new Set<string>();

  for (const header of headers) {
    if (!header) {
      throw new AppError('CSV headers must not be empty', 400, 'INVALID_CSV');
    }

    if (seenHeaders.has(header)) {
      throw new AppError(`Duplicate CSV header: ${header}`, 400, 'INVALID_CSV');
    }

    seenHeaders.add(header);
  }

  const rows: ParsedCsvRow[] = [];

  dataRows.forEach((record, index) => {
    const rowValues = record ?? [];
    const values: Record<string, string> = {};
    let hasData = false;

    headers.forEach((header, headerIndex) => {
      const cell = normalizeCell(rowValues[headerIndex]);
      values[header] = cell;

      if (cell.trim() !== '') {
        hasData = true;
      }
    });

    if (!hasData) {
      return;
    }

    rows.push({
      rowNumber: index + 2,
      values,
    });
  });

  if (rows.length === 0) {
    throw new AppError('CSV file does not contain any data rows', 400, 'INVALID_CSV');
  }

  return {
    headers,
    rows,
  };
};

const stringifyCsvValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return '';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
};

const escapeCsvValue = (value: unknown): string => {
  const stringValue = stringifyCsvValue(value);

  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
};

export const serializeCsv = (headers: string[], rows: Array<Record<string, unknown>>): string => {
  const lines = [headers.map(escapeCsvValue).join(',')];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(','));
  }

  return `\uFEFF${lines.join('\n')}`;
};
