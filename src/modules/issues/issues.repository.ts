import { desc, eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stationIssueRecords } from '../../db/schema';

type IssueInsert = typeof stationIssueRecords.$inferInsert;

export class IssuesRepository {
  async listByStationId(stationId: string) {
    return db.query.stationIssueRecords.findMany({
      where: eq(stationIssueRecords.stationId, stationId),
      orderBy: [desc(stationIssueRecords.createdAt)],
    });
  }

  async create(values: IssueInsert) {
    const [created] = await db.insert(stationIssueRecords).values(values).returning();

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

  async updateStatus(id: string, status: 'open' | 'in_progress' | 'resolved' | 'closed') {
    const [updated] = await db
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
