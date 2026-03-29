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

export class IssuesService {
  constructor(
    private readonly repository: IssuesRepository = issuesRepository,
    private readonly stationService: StationsService = stationsService,
  ) {}

  async listByStation(stationId: string) {
    await this.stationService.ensureExists(stationId);
    return this.repository.listByStationId(stationId);
  }

  async create(userId: string, stationId: string, payload: CreateIssuePayload) {
    await this.stationService.ensureExists(stationId);

    try {
      const created = await this.repository.create({
        stationId,
        title: payload.title,
        description: payload.description,
        severity: payload.severity ?? 'medium',
        status: 'open',
        reportedBy: userId,
        assignedTo: payload.assignedTo,
      });

      await writeAuditLog({
        actorUserId: userId,
        entityType: 'station_issue_record',
        entityId: created.id,
        action: 'station_issue.created',
        metadataJson: {
          stationId,
          severity: created.severity,
        },
      });

      return created;
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new AppError('Assigned user does not exist', 400, 'INVALID_ASSIGNEE');
      }

      throw error;
    }
  }

  async updateStatus(userId: string, issueId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed') {
    const issue = await this.repository.findById(issueId);

    if (!issue) {
      throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
    }

    const updated = await this.repository.updateStatus(issueId, status);

    if (!updated) {
      throw new AppError('Issue not found', 404, 'ISSUE_NOT_FOUND');
    }

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'station_issue_record',
      entityId: issueId,
      action: 'station_issue.status_changed',
      metadataJson: {
        status,
      },
    });

    return updated;
  }
}

export const issuesService = new IssuesService();
