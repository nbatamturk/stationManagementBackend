import { db } from '../../db/client';
import { writeAuditLog } from '../../utils/audit-log';
import { isForeignKeyViolation } from '../../utils/db-errors';
import { AppError } from '../../utils/errors';

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

    try {
      const created = await db.transaction(async (tx) => {
        const issue = await this.repository.create(
          {
            stationId,
            title: payload.title,
            description: payload.description,
            severity: payload.severity ?? 'medium',
            status: 'open',
            reportedBy: userId,
            assignedTo: payload.assignedTo,
          },
          tx,
        );

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

    try {
      const updated = await db.transaction(async (tx) => {
        const resolvedAt =
          payload.status === undefined
            ? issue.resolvedAt
            : payload.status === 'resolved' || payload.status === 'closed'
              ? issue.resolvedAt ?? new Date()
              : null;

        const record = await this.repository.updateById(
          issueId,
          {
            title: payload.title,
            description: payload.description,
            severity: payload.severity,
            status: payload.status,
            assignedTo: payload.assignedTo,
            resolvedAt,
          },
          tx,
        );

        if (!record) {
          throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
        }

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

    await db.transaction(async (tx) => {
      const deleted = await this.repository.deleteById(issueId, tx);

      if (!deleted) {
        throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
      }

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
    });

    return {
      success: true,
      id: issueId,
    };
  }
}

export const issuesService = new IssuesService();
