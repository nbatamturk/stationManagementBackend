import { and, asc, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm';

import { db } from '../../db/client';
import { auditLogs } from '../../db/schema';

export type AuditLogsFilters = {
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  action?: string;
  createdFrom?: Date;
  createdTo?: Date;
  page: number;
  limit: number;
  sortBy?: 'createdAt';
  sortOrder?: 'asc' | 'desc';
};

export class AuditLogsRepository {
  async list(filters: AuditLogsFilters) {
    const conditions: SQL[] = [];

    if (filters.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }

    if (filters.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }

    if (filters.actorUserId) {
      conditions.push(eq(auditLogs.actorUserId, filters.actorUserId));
    }

    if (filters.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }

    if (filters.createdFrom) {
      conditions.push(gte(auditLogs.createdAt, filters.createdFrom));
    }

    if (filters.createdTo) {
      conditions.push(lte(auditLogs.createdAt, filters.createdTo));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countRows = await db.select({ total: count() }).from(auditLogs).where(whereClause);
    const total = countRows[0]?.total ?? 0;

    const rows = await db
      .select()
      .from(auditLogs)
      .where(whereClause)
      .orderBy(
        filters.sortOrder === 'asc' ? asc(auditLogs.createdAt) : desc(auditLogs.createdAt),
        filters.sortOrder === 'asc' ? asc(auditLogs.id) : desc(auditLogs.id),
      )
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    return {
      rows,
      total,
    };
  }
}

export const auditLogsRepository = new AuditLogsRepository();
