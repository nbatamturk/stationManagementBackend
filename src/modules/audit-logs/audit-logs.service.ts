import { AppError } from '../../utils/errors';

import { auditLogsRepository, type AuditLogsRepository } from './audit-logs.repository';

type AuditLogsListQuery = {
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  action?: string;
  fromDate?: string;
  toDate?: string;
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

    if (query.fromDate && query.toDate && new Date(query.fromDate) > new Date(query.toDate)) {
      throw new AppError('fromDate must be less than or equal to toDate', 400, 'INVALID_FILTER');
    }

    const { rows, total } = await this.repository.list({
      entityType: query.entityType,
      entityId: query.entityId,
      actorUserId: query.actorUserId,
      action: query.action,
      fromDate: query.fromDate ? new Date(query.fromDate) : undefined,
      toDate: query.toDate ? new Date(query.toDate) : undefined,
      page,
      limit,
      sortBy: query.sortBy ?? 'createdAt',
      sortOrder: query.sortOrder ?? 'desc',
    });

    return {
      data: rows,
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
