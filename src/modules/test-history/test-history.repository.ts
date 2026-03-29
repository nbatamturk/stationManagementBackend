import { desc, eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stationTestHistory } from '../../db/schema';

type TestHistoryInsert = typeof stationTestHistory.$inferInsert;

export class TestHistoryRepository {
  async listByStationId(stationId: string) {
    return db.query.stationTestHistory.findMany({
      where: eq(stationTestHistory.stationId, stationId),
      orderBy: [desc(stationTestHistory.testDate)],
    });
  }

  async create(values: TestHistoryInsert) {
    const [created] = await db.insert(stationTestHistory).values(values).returning();

    if (!created) {
      throw new Error('Failed to create test history');
    }

    return created;
  }
}

export const testHistoryRepository = new TestHistoryRepository();
