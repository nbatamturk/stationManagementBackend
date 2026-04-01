import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { attachments, stations } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { AppError } from '../../utils/errors';

import { issuesRepository, type IssuesRepository } from '../issues/issues.repository';
import { stationsRepository, type StationsRepository } from '../stations/stations.repository';
import { testHistoryRepository, type TestHistoryRepository } from '../test-history/test-history.repository';
import {
  buildAttachmentContentDisposition,
  buildAttachmentStoragePath,
  deleteStoredAttachmentFile,
  ensureAttachmentReadable,
  sanitizeOriginalFileName,
  validateAttachmentFile,
  writeAttachmentBuffer,
} from './attachments.storage';
import { attachmentsRepository, type AttachmentsRepository } from './attachments.repository';

type AttachmentRecord = typeof attachments.$inferSelect;
type AttachmentTargetType = 'station' | 'issue' | 'testHistory';
type AttachmentUploadInput = {
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
};
type AttachmentTargetContext = {
  targetType: AttachmentTargetType;
  stationId: string;
  issueId: string | null;
  testHistoryId: string | null;
};

const getDeleteReasonAction = (reason: string) => {
  switch (reason) {
    case 'station_deleted':
      return 'station.deleted';
    case 'issue_deleted':
      return 'issue.deleted';
    case 'test_history_deleted':
      return 'test_history.deleted';
    default:
      return reason;
  }
};

export class AttachmentsService {
  constructor(
    private readonly repository: AttachmentsRepository = attachmentsRepository,
    private readonly stationsRepo: StationsRepository = stationsRepository,
    private readonly issuesRepo: IssuesRepository = issuesRepository,
    private readonly testHistoryRepo: TestHistoryRepository = testHistoryRepository,
  ) {}

  async listByStation(stationId: string) {
    await this.ensureStationExists(stationId);
    const records = await this.repository.listByStationId(stationId);
    return records.map((record) => this.toAttachmentResponse(record));
  }

  async listByIssue(issueId: string) {
    await this.ensureIssueExists(issueId);
    const records = await this.repository.listByIssueId(issueId);
    return records.map((record) => this.toAttachmentResponse(record));
  }

  async listByTestHistory(testHistoryId: string) {
    await this.ensureTestHistoryExists(testHistoryId);
    const records = await this.repository.listByTestHistoryId(testHistoryId);
    return records.map((record) => this.toAttachmentResponse(record));
  }

  async uploadToStation(userId: string, stationId: string, file: AttachmentUploadInput) {
    const target = await this.ensureStationExists(stationId);
    return this.upload(userId, { targetType: 'station', stationId: target.id, issueId: null, testHistoryId: null }, file);
  }

  async uploadToIssue(userId: string, issueId: string, file: AttachmentUploadInput) {
    const issue = await this.ensureIssueExists(issueId);
    return this.upload(
      userId,
      {
        targetType: 'issue',
        stationId: issue.stationId,
        issueId: issue.id,
        testHistoryId: null,
      },
      file,
    );
  }

  async uploadToTestHistory(userId: string, testHistoryId: string, file: AttachmentUploadInput) {
    const record = await this.ensureTestHistoryExists(testHistoryId);
    return this.upload(
      userId,
      {
        targetType: 'testHistory',
        stationId: record.stationId,
        issueId: null,
        testHistoryId: record.id,
      },
      file,
    );
  }

  async delete(userId: string, attachmentId: string) {
    const deleted = await db.transaction(async (tx) => {
      const record = await this.repository.deleteById(attachmentId, tx);

      if (!record) {
        throw new AppError('Attachment not found', 404, 'ATTACHMENT_NOT_FOUND');
      }

      await this.writeDeleteAuditLog(tx, userId, record, 'manual_delete');
      await tx.update(stations).set({ updatedAt: new Date(), updatedBy: userId }).where(eq(stations.id, record.stationId));
      return record;
    });

    await this.cleanupStoredFiles([deleted]);

    return {
      success: true,
      id: attachmentId,
    };
  }

  async prepareDownload(userId: string, attachmentId: string) {
    const record = await this.repository.findById(attachmentId);

    if (!record) {
      throw new AppError('Attachment not found', 404, 'ATTACHMENT_NOT_FOUND');
    }

    const absolutePath = await ensureAttachmentReadable(record.storagePath);

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'attachment',
      entityId: record.id,
      action: 'attachment.downloaded',
      metadataJson: this.buildAuditMetadata(record, {
        targetType: this.getTargetType(record),
      }),
    });

    return {
      absolutePath,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      contentDisposition: buildAttachmentContentDisposition(record.originalFileName),
    };
  }

  async deleteByStationId(userId: string, stationId: string, executor: any = db, reason = 'station_deleted') {
    const deletedRecords = await this.repository.deleteByStationId(stationId, executor);
    await this.writeDeleteAuditLogs(executor, userId, deletedRecords, reason);
    return deletedRecords;
  }

  async deleteByIssueId(userId: string, issueId: string, executor: any = db, reason = 'issue_deleted') {
    const deletedRecords = await this.repository.deleteByIssueId(issueId, executor);
    await this.writeDeleteAuditLogs(executor, userId, deletedRecords, reason);
    return deletedRecords;
  }

  async deleteByTestHistoryId(userId: string, testHistoryId: string, executor: any = db, reason = 'test_history_deleted') {
    const deletedRecords = await this.repository.deleteByTestHistoryId(testHistoryId, executor);
    await this.writeDeleteAuditLogs(executor, userId, deletedRecords, reason);
    return deletedRecords;
  }

  async cleanupStoredFiles(records: AttachmentRecord[]) {
    const results = await Promise.allSettled(records.map((record) => deleteStoredAttachmentFile(record.storagePath)));

    for (const result of results) {
      if (result.status === 'rejected') {
        console.error('Failed to remove attachment file from local storage', result.reason);
      }
    }
  }

  private async upload(userId: string, target: AttachmentTargetContext, file: AttachmentUploadInput) {
    const mimeType = validateAttachmentFile({
      mimeType: file.mimeType,
      originalFileName: file.originalFileName,
      sizeBytes: file.sizeBytes,
    });
    const originalFileName = sanitizeOriginalFileName(file.originalFileName);
    const storagePath = buildAttachmentStoragePath({
      stationId: target.stationId,
      issueId: target.issueId,
      testHistoryId: target.testHistoryId,
      originalFileName,
      mimeType,
    });

    await writeAttachmentBuffer(storagePath, file.buffer);

    try {
      const created = await db.transaction(async (tx) => {
        const record = await this.repository.create(
          {
            stationId: target.stationId,
            issueId: target.issueId,
            testHistoryId: target.testHistoryId,
            originalFileName,
            mimeType,
            sizeBytes: file.sizeBytes,
            storagePath,
            uploadedBy: userId,
          },
          tx,
        );

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'attachment',
            entityId: record.id,
            action: 'attachment.uploaded',
            metadataJson: this.buildAuditMetadata(record, {
              targetType: target.targetType,
            }),
          },
          tx,
        );

        await tx.update(stations).set({ updatedAt: new Date(), updatedBy: userId }).where(eq(stations.id, target.stationId));

        return record;
      });

      return this.toAttachmentResponse(created);
    } catch (error) {
      try {
        await deleteStoredAttachmentFile(storagePath);
      } catch (cleanupError) {
        console.error('Failed to roll back attachment file after database error', cleanupError);
      }

      throw error;
    }
  }

  private async ensureStationExists(stationId: string) {
    const station = await this.stationsRepo.findById(stationId);

    if (!station) {
      throw new AppError('Station not found', 404, 'STATION_NOT_FOUND');
    }

    return station;
  }

  private async ensureIssueExists(issueId: string) {
    const issue = await this.issuesRepo.findById(issueId);

    if (!issue) {
      throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
    }

    return issue;
  }

  private async ensureTestHistoryExists(testHistoryId: string) {
    const record = await this.testHistoryRepo.findById(testHistoryId);

    if (!record) {
      throw new AppError('Test history record not found', 404, 'TEST_HISTORY_NOT_FOUND');
    }

    return record;
  }

  private async writeDeleteAuditLogs(executor: any, userId: string, records: AttachmentRecord[], reason: string) {
    for (const record of records) {
      await this.writeDeleteAuditLog(executor, userId, record, reason);
    }
  }

  private async writeDeleteAuditLog(executor: any, userId: string, record: AttachmentRecord, reason: string) {
    await writeAuditLog(
      {
        actorUserId: userId,
        entityType: 'attachment',
        entityId: record.id,
        action: 'attachment.deleted',
        metadataJson: this.buildAuditMetadata(record, {
          targetType: this.getTargetType(record),
          deleteReason: reason,
          deleteTriggeredBy: getDeleteReasonAction(reason),
        }),
      },
      executor,
    );
  }

  private getTargetType(record: AttachmentRecord): AttachmentTargetType {
    if (record.issueId) {
      return 'issue';
    }

    if (record.testHistoryId) {
      return 'testHistory';
    }

    return 'station';
  }

  private buildAuditMetadata(
    record: AttachmentRecord,
    extra: {
      targetType: AttachmentTargetType;
      deleteReason?: string;
      deleteTriggeredBy?: string;
    },
  ) {
    return {
      stationId: record.stationId,
      issueId: record.issueId,
      testHistoryId: record.testHistoryId,
      originalFileName: record.originalFileName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      ...extra,
    };
  }

  private toAttachmentResponse(record: AttachmentRecord) {
    return {
      id: record.id,
      stationId: record.stationId,
      issueId: record.issueId,
      testHistoryId: record.testHistoryId,
      targetType: this.getTargetType(record),
      originalFileName: record.originalFileName,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      uploadedBy: record.uploadedBy,
      createdAt: record.createdAt,
      downloadUrl: `/attachments/${record.id}/download`,
    };
  }
}

export const attachmentsService = new AttachmentsService();
