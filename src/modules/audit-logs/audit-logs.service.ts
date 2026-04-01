import { AppError } from '../../utils/errors';

import { auditLogsRepository, type AuditLogsRepository } from './audit-logs.repository';

type AuditLogsListQuery = {
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  action?: string;
  createdFrom?: string;
  createdTo?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
};

export class AuditLogsService {
  constructor(private readonly repository: AuditLogsRepository = auditLogsRepository) {}

  async list(query: AuditLogsListQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    if (query.createdFrom && query.createdTo && new Date(query.createdFrom) > new Date(query.createdTo)) {
      throw new AppError('createdFrom must be less than or equal to createdTo', 400, 'INVALID_FILTER');
    }

    const { rows, total } = await this.repository.list({
      entityType: query.entityType,
      entityId: query.entityId,
      actorUserId: query.actorUserId,
      action: query.action,
      createdFrom: query.createdFrom ? new Date(query.createdFrom) : undefined,
      createdTo: query.createdTo ? new Date(query.createdTo) : undefined,
      page,
      limit,
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc',
    });

    return {
      data: rows.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        entityType: row.entityType,
        entityId: row.entityId,
        action: row.action,
        metadata: row.metadataJson,
        createdAt: row.createdAt,
      })),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }
}

export const auditLogsService = new AuditLogsService();
