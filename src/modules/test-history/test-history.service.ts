import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stations } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { AppError } from '../../utils/errors';
import { normalizeOptionalDateTime, normalizeOptionalMultilineText, normalizeOptionalObject } from '../../utils/input';

import { attachmentsService } from '../attachments/attachments.service';
import { stationsService, type StationsService } from '../stations/stations.service';
import { testHistoryRepository, type TestHistoryRepository } from './test-history.repository';

type TestHistoryPayload = {
  testDate?: string;
  result: 'pass' | 'fail' | 'warning';
  notes?: string;
  metrics?: Record<string, unknown>;
};

type TestHistoryUpdatePayload = {
  testDate?: string;
  result?: 'pass' | 'fail' | 'warning';
  notes?: string | null;
  metrics?: Record<string, unknown>;
};

export class TestHistoryService {
  constructor(
    private readonly repository: TestHistoryRepository = testHistoryRepository,
    private readonly stationService: StationsService = stationsService,
  ) {}

  async listByStation(stationId: string) {
    await this.stationService.ensureExists(stationId);

    const rows = await this.repository.listByStationId(stationId);
    return rows.map((row) => this.toTestHistoryResponse(row));
  }

  async create(userId: string, stationId: string, payload: TestHistoryPayload) {
    await this.stationService.ensureExists(stationId);
    const normalizedNotes = normalizeOptionalMultilineText(payload.notes, 'Test notes', {
      maxLength: 2000,
    });
    const normalizedMetrics = normalizeOptionalObject(payload.metrics, 'Test metrics', {
      maxKeys: 100,
    });
    const testDate = normalizeOptionalDateTime(payload.testDate, 'Test date') ?? new Date();

    const created = await db.transaction(async (tx) => {
      const inserted = await this.repository.create(
        {
          stationId,
          testDate,
          result: payload.result,
          notes: normalizedNotes,
          metricsJson: normalizedMetrics ?? {},
          testedBy: userId,
        },
        tx,
      );

      await tx
        .update(stations)
        .set({ lastTestDate: testDate, updatedAt: new Date(), updatedBy: userId })
        .where(eq(stations.id, stationId));

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'station_test_history',
          entityId: inserted.id,
          action: 'station_test_history.created',
          metadataJson: {
            stationId,
            result: payload.result,
          },
        },
        tx,
      );

      return inserted;
    });

    return this.toTestHistoryResponse(created);
  }

  async update(userId: string, id: string, payload: TestHistoryUpdatePayload) {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new AppError('Test history record not found', 404, 'TEST_HISTORY_NOT_FOUND');
    }

    const normalizedNotes = normalizeOptionalMultilineText(payload.notes, 'Test notes', {
      emptyAs: 'null',
      maxLength: 2000,
    });
    const normalizedMetrics = normalizeOptionalObject(payload.metrics, 'Test metrics', {
      maxKeys: 100,
    });
    const normalizedTestDate = normalizeOptionalDateTime(payload.testDate, 'Test date');

    if (Object.keys(payload).length === 0) {
      return this.toTestHistoryResponse(existing);
    }

    const updated = await db.transaction(async (tx) => {
      const record = await this.repository.updateById(
        id,
        {
          testDate: normalizedTestDate ?? undefined,
          result: payload.result,
          notes: normalizedNotes,
          metricsJson: normalizedMetrics ?? undefined,
        },
        tx,
      );

      if (!record) {
        throw new AppError('Test history record not found', 404, 'TEST_HISTORY_NOT_FOUND');
      }

      const latest = await this.repository.getLatestTestDateByStation(existing.stationId, tx);
      await tx
        .update(stations)
        .set({ lastTestDate: latest, updatedAt: new Date(), updatedBy: userId })
        .where(eq(stations.id, existing.stationId));

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'station_test_history',
          entityId: id,
          action: 'station_test_history.updated',
          metadataJson: {
            stationId: existing.stationId,
          },
        },
        tx,
      );

      return record;
    });

    return this.toTestHistoryResponse(updated);
  }

  async delete(userId: string, id: string) {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new AppError('Test history record not found', 404, 'TEST_HISTORY_NOT_FOUND');
    }

    const deletedAttachments = await db.transaction(async (tx) => {
      const removedAttachments = await attachmentsService.deleteByTestHistoryId(userId, id, tx);
      const deleted = await this.repository.deleteById(id, tx);

      if (!deleted) {
        throw new AppError('Test history record not found', 404, 'TEST_HISTORY_NOT_FOUND');
      }

      const latest = await this.repository.getLatestTestDateByStation(existing.stationId, tx);
      await tx
        .update(stations)
        .set({ lastTestDate: latest, updatedAt: new Date(), updatedBy: userId })
        .where(eq(stations.id, existing.stationId));

      await writeAuditLog(
        {
          actorUserId: userId,
          entityType: 'station_test_history',
          entityId: id,
          action: 'station_test_history.deleted',
          metadataJson: {
            stationId: existing.stationId,
          },
        },
        tx,
      );

      return removedAttachments;
    });

    await attachmentsService.cleanupStoredFiles(deletedAttachments);

    return {
      success: true,
      id,
    };
  }

  private toTestHistoryResponse(row: {
    id: string;
    stationId: string;
    testDate: Date;
    result: 'pass' | 'fail' | 'warning';
    notes: string | null;
    metricsJson: Record<string, unknown>;
    testedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      stationId: row.stationId,
      testDate: row.testDate,
      result: row.result,
      notes: row.notes,
      metrics: row.metricsJson ?? {},
      testedBy: row.testedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

export const testHistoryService = new TestHistoryService();
