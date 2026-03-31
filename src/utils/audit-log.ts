import { db } from '../db/client';
import { auditLogs } from '../db/schema';

export type AuditLogInput = {
  actorUserId?: string;
  entityType: string;
  entityId: string;
  action: string;
  metadataJson?: Record<string, unknown>;
};

export const writeAuditLog = async (input: AuditLogInput, executor: any = db): Promise<void> => {
  await executor.insert(auditLogs).values({
    actorUserId: input.actorUserId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    metadataJson: input.metadataJson ?? {},
  });
};
