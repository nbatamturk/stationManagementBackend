import { desc, eq, max } from 'drizzle-orm';

import { db } from '../../db/client';
import { stationTestHistory } from '../../db/schema';

type TestHistoryInsert = typeof stationTestHistory.$inferInsert;
type TestHistoryUpdate = Partial<Omit<TestHistoryInsert, 'id' | 'createdAt' | 'stationId'>>;

export class TestHistoryRepository {
  async listByStationId(stationId: string) {
    return db.query.stationTestHistory.findMany({
      where: eq(stationTestHistory.stationId, stationId),
      orderBy: [desc(stationTestHistory.testDate)],
    });
  }

  async findById(id: string) {
    return db.query.stationTestHistory.findFirst({
      where: eq(stationTestHistory.id, id),
    });
  }

  async create(values: TestHistoryInsert, executor: any = db) {
    const [created] = await executor.insert(stationTestHistory).values(values).returning();

    if (!created) {
      throw new Error('Failed to create test history');
    }

    return created;
  }

  async updateById(id: string, values: TestHistoryUpdate, executor: any = db) {
    const [updated] = await executor
      .update(stationTestHistory)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(stationTestHistory.id, id))
      .returning();

    return updated;
  }

  async deleteById(id: string, executor: any = db) {
    const [deleted] = await executor
      .delete(stationTestHistory)
      .where(eq(stationTestHistory.id, id))
      .returning({ id: stationTestHistory.id, stationId: stationTestHistory.stationId });

    return deleted;
  }

  async getLatestTestDateByStation(stationId: string, executor: any = db) {
    const [row] = await executor
      .select({ latestTestDate: max(stationTestHistory.testDate) })
      .from(stationTestHistory)
      .where(eq(stationTestHistory.stationId, stationId));

    return row?.latestTestDate ?? null;
  }
}

export const testHistoryRepository = new TestHistoryRepository();
