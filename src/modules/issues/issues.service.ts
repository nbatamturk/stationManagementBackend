import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stations } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { isForeignKeyViolation } from '../../utils/db-errors';
import { AppError } from '../../utils/errors';
import {
  normalizeOptionalMultilineText,
  normalizeOptionalSingleLineText,
  normalizeRequiredSingleLineText,
} from '../../utils/input';

import { attachmentsService } from '../attachments/attachments.service';
import { stationsService, type StationsService } from '../stations/stations.service';
import { issuesRepository, type IssuesRepository } from './issues.repository';

type CreateIssuePayload = {
  title: string;
  description?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
};

type UpdateIssuePayload = {
  title?: string;
  description?: string | null;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string | null;
};

export class IssuesService {
  constructor(
    private readonly repository: IssuesRepository = issuesRepository,
    private readonly stationService: StationsService = stationsService,
  ) {}

  async listByStation(stationId: string) {
    await this.stationService.ensureExists(stationId);
    return this.repository.listByStationId(stationId);
  }

  async getById(id: string) {
    const issue = await this.repository.findById(id);

    if (!issue) {
      throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
    }

    return issue;
  }

  async create(userId: string, stationId: string, payload: CreateIssuePayload) {
    await this.stationService.ensureExists(stationId);
    const normalizedPayload = {
      ...payload,
      title: normalizeRequiredSingleLineText(payload.title, 'Issue title', {
        maxLength: 160,
        minLength: 3,
      }),
      description: normalizeOptionalMultilineText(payload.description, 'Issue description', {
        maxLength: 4000,
      }),
    };

    try {
      const created = await db.transaction(async (tx) => {
        const issue = await this.repository.create(
          {
            stationId,
            title: normalizedPayload.title,
            description: normalizedPayload.description,
            severity: normalizedPayload.severity ?? 'medium',
            status: 'open',
            reportedBy: userId,
            assignedTo: normalizedPayload.assignedTo,
          },
          tx,
        );

        await tx.update(stations).set({ updatedAt: new Date(), updatedBy: userId }).where(eq(stations.id, stationId));

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station_issue_record',
            entityId: issue.id,
            action: 'station_issue.created',
            metadataJson: {
              stationId,
              severity: issue.severity,
            },
          },
          tx,
        );

        return issue;
      });

      return created;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new AppError('Assigned user does not exist', 400, 'INVALID_ASSIGNEE');
      }

      throw error;
    }
  }

  async update(userId: string, issueId: string, payload: UpdateIssuePayload) {
    const issue = await this.repository.findById(issueId);

    if (!issue) {
      throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
    }

    const normalizedPayload = {
      ...payload,
      title:
        payload.title === undefined
          ? undefined
          : normalizeRequiredSingleLineText(payload.title, 'Issue title', {
              maxLength: 160,
              minLength: 3,
            }),
      description: normalizeOptionalMultilineText(payload.description, 'Issue description', {
        emptyAs: 'null',
        maxLength: 4000,
      }),
      status: payload.status,
    };

    try {
      const updated = await db.transaction(async (tx) => {
        const resolvedAt =
          normalizedPayload.status === undefined
            ? issue.resolvedAt
            : normalizedPayload.status === 'resolved' || normalizedPayload.status === 'closed'
              ? issue.resolvedAt ?? new Date()
              : null;

        const record = await this.repository.updateById(
          issueId,
          {
            title: normalizedPayload.title,
            description: normalizedPayload.description,
            severity: normalizedPayload.severity,
            status: normalizedPayload.status,
            assignedTo: normalizedPayload.assignedTo,
            resolvedAt,
          },
          tx,
        );

        if (!record) {
          throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
        }

        await tx
          .update(stations)
          .set({ updatedAt: new Date(), updatedBy: userId })
          .where(eq(stations.id, issue.stationId));

        await writeAuditLog(
          {
            actorUserId: userId,
            entityType: 'station_issue_record',
            entityId: issueId,
            action: 'station_issue.updated',
            metadataJson: {
              stationId: issue.stationId,
            },
          },
          tx,
        );

        return record;
      });

      return updated;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new AppError('Assigned user does not exist', 400, 'INVALID_ASSIGNEE');
      }

      throw error;
    }
  }

  async updateStatus(userId: string, issueId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed') {
    const updated = await this.update(userId, issueId, { status });

    return updated;
  }

  async delete(userId: string, issueId: string) {
    const issue = await this.repository.findById(issueId);

    if (!issue) {
      throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
    }

    const deletedAttachments = await db.transaction(async (tx) => {
      const removedAttachments = await attachmentsService.deleteByIssueId(userId, issueId, tx);
      const deleted = await this.repository.deleteById(issueId, tx);

      if (!deleted) {
        throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
      }

      await tx.update(stations).set({ updatedAt: new Date(), updatedBy: userId }).where(eq(stations.id, issue.stationId));

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'station_issue_record',
          entityId: issueId,
          action: 'station_issue.deleted',
          metadataJson: {
            stationId: issue.stationId,
          },
        },
        tx,
      );

      return removedAttachments;
    });

    await attachmentsService.cleanupStoredFiles(deletedAttachments);

    return {
      success: true,
      id: issueId,
    };
  }
}

export const issuesService = new IssuesService();
