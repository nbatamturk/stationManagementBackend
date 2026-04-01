import * as SQLite from 'expo-sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { applySchema } from '@/database/schema';
import { seedDatabaseIfNeeded } from '@/database/seed';

const DB_NAME = 'station_tracker.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

const initializeDatabase = async (): Promise<SQLiteDatabase> => {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA foreign_keys = ON;');
  await applySchema(db);
  await seedDatabaseIfNeeded(db);
  return db;
};

export const getDatabase = async (): Promise<SQLiteDatabase> => {
  if (!databasePromise) {
    databasePromise = initializeDatabase();
  }

  return databasePromise;
};

export const withDatabase = async <T>(
  operation: (db: SQLiteDatabase) => Promise<T>,
): Promise<T> => {
  const db = await getDatabase();
  return operation(db);
};
