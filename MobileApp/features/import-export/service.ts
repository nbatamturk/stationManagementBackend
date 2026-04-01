import { withDatabase } from '@/database';
import type { DataExchangeRun, DataOperationStatus, DataOperationType } from '@/types';
import { getNowIso } from '@/utils/date';
import { createId } from '@/utils/id';

type ExchangeRow = {
  id: string;
  operationType: DataOperationType;
  status: DataOperationStatus;
  dataFormat: DataExchangeRun['dataFormat'];
  fileUri: string | null;
  summaryJson: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

const mapRow = (row: ExchangeRow): DataExchangeRun => ({
  id: row.id,
  operationType: row.operationType,
  status: row.status,
  dataFormat: row.dataFormat,
  fileUri: row.fileUri,
  summaryJson: row.summaryJson,
  errorMessage: row.errorMessage,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

export const getDataExchangeRuns = async (): Promise<DataExchangeRun[]> => {
  return withDatabase(async (db) => {
    const rows = await db.getAllAsync<ExchangeRow>(
      `SELECT *
       FROM data_exchange_runs
       ORDER BY createdAt DESC;`,
    );

    return rows.map(mapRow);
  });
};

export const createDataExchangeRun = async (input: {
  operationType: DataOperationType;
  dataFormat: DataExchangeRun['dataFormat'];
  fileUri?: string;
}): Promise<string> => {
  const id = createId('dx');
  const now = getNowIso();

  await withDatabase(async (db) => {
    await db.runAsync(
      `INSERT INTO data_exchange_runs
        (id, operationType, status, dataFormat, fileUri, summaryJson, errorMessage, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      id,
      input.operationType,
      'pending',
      input.dataFormat,
      input.fileUri ?? null,
      null,
      null,
      now,
      now,
    );
  });

  return id;
};

export const updateDataExchangeRunStatus = async (input: {
  id: string;
  status: DataOperationStatus;
  summaryJson?: string;
  errorMessage?: string;
}): Promise<void> => {
  const now = getNowIso();

  await withDatabase(async (db) => {
    await db.runAsync(
      `UPDATE data_exchange_runs
       SET status = ?,
           summaryJson = ?,
           errorMessage = ?,
           updatedAt = ?
       WHERE id = ?;`,
      input.status,
      input.summaryJson ?? null,
      input.errorMessage ?? null,
      now,
      input.id,
    );
  });
};
