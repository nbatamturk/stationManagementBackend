import { and, desc, eq, isNull } from 'drizzle-orm';

import { db } from '../../db/client';
import { attachments } from '../../db/schema';

type AttachmentInsert = typeof attachments.$inferInsert;

export class AttachmentsRepository {
  async listByStationId(stationId: string) {
    return db.query.attachments.findMany({
      where: and(eq(attachments.stationId, stationId), isNull(attachments.issueId), isNull(attachments.testHistoryId)),
      orderBy: [desc(attachments.createdAt)],
    });
  }

  async listByIssueId(issueId: string) {
    return db.query.attachments.findMany({
      where: eq(attachments.issueId, issueId),
      orderBy: [desc(attachments.createdAt)],
    });
  }

  async listByTestHistoryId(testHistoryId: string) {
    return db.query.attachments.findMany({
      where: eq(attachments.testHistoryId, testHistoryId),
      orderBy: [desc(attachments.createdAt)],
    });
  }

  async findById(id: string) {
    return db.query.attachments.findFirst({
      where: eq(attachments.id, id),
    });
  }

  async create(values: AttachmentInsert, executor: any = db) {
    const [created] = await executor.insert(attachments).values(values).returning();

    if (!created) {
      throw new Error('Failed to create attachment');
    }

    return created;
  }

  async deleteById(id: string, executor: any = db) {
    const [deleted] = await executor.delete(attachments).where(eq(attachments.id, id)).returning();
    return deleted;
  }

  async deleteByStationId(stationId: string, executor: any = db) {
    return executor.delete(attachments).where(eq(attachments.stationId, stationId)).returning();
  }

  async deleteByIssueId(issueId: string, executor: any = db) {
    return executor.delete(attachments).where(eq(attachments.issueId, issueId)).returning();
  }

  async deleteByTestHistoryId(testHistoryId: string, executor: any = db) {
    return executor.delete(attachments).where(eq(attachments.testHistoryId, testHistoryId)).returning();
  }
}

export const attachmentsRepository = new AttachmentsRepository();
