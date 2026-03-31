import { desc, eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stationIssueRecords } from '../../db/schema';

type IssueInsert = typeof stationIssueRecords.$inferInsert;
type IssueUpdate = Partial<Omit<IssueInsert, 'id' | 'createdAt'>>;

export class IssuesRepository {
  async listByStationId(stationId: string) {
    return db.query.stationIssueRecords.findMany({
      where: eq(stationIssueRecords.stationId, stationId),
      orderBy: [desc(stationIssueRecords.createdAt)],
    });
  }

  async create(values: IssueInsert, executor: any = db) {
    const [created] = await executor.insert(stationIssueRecords).values(values).returning();

    if (!created) {
      throw new Error('Failed to create issue');
    }

    return created;
  }

  async findById(id: string) {
    return db.query.stationIssueRecords.findFirst({
      where: eq(stationIssueRecords.id, id),
    });
  }

  async updateById(id: string, values: IssueUpdate, executor: any = db) {
    const [updated] = await executor
      .update(stationIssueRecords)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(stationIssueRecords.id, id))
      .returning();

    return updated;
  }

  async deleteById(id: string, executor: any = db) {
    const [deleted] = await executor
      .delete(stationIssueRecords)
      .where(eq(stationIssueRecords.id, id))
      .returning({ id: stationIssueRecords.id });

    return deleted;
  }

  async updateStatus(id: string, status: 'open' | 'in_progress' | 'resolved' | 'closed', executor: any = db) {
    const [updated] = await executor
      .update(stationIssueRecords)
      .set({
        status,
        resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(stationIssueRecords.id, id))
      .returning();

    return updated;
  }
}

export const issuesRepository = new IssuesRepository();
