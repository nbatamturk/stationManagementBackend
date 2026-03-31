import { eq } from 'drizzle-orm';

import { db } from '../../db/client';
import { stations } from '../../db/schema';
import { writeAuditLog } from '../../utils/audit-log';
import { AppError } from '../../utils/errors';

import { stationsService, type StationsService } from '../stations/stations.service';
import { testHistoryRepository, type TestHistoryRepository } from './test-history.repository';

type TestHistoryPayload = {
  testDate?: string;
  result: 'pass' | 'fail' | 'warning';
  notes?: string;
  metricsJson?: Record<string, unknown>;
};

type TestHistoryUpdatePayload = {
  testDate?: string;
  result?: 'pass' | 'fail' | 'warning';
  notes?: string | null;
  metricsJson?: Record<string, unknown>;
};

export class TestHistoryService {
  constructor(
    private readonly repository: TestHistoryRepository = testHistoryRepository,
    private readonly stationService: StationsService = stationsService,
  ) {}

  async listByStation(stationId: string) {
    await this.stationService.ensureExists(stationId);

    const rows = await this.repository.listByStationId(stationId);
    return rows.map((row) => ({
      ...row,
      metricsJson: row.metricsJson ?? {},
    }));
  }

  async create(userId: string, stationId: string, payload: TestHistoryPayload) {
    await this.stationService.ensureExists(stationId);

    const testDate = payload.testDate ? new Date(payload.testDate) : new Date();

    const created = await db.transaction(async (tx) => {
      const inserted = await this.repository.create(
        {
          stationId,
          testDate,
          result: payload.result,
          notes: payload.notes,
          metricsJson: payload.metricsJson ?? {},
          testedBy: userId,
        },
        tx,
      );

      await tx.update(stations).set({ lastTestDate: testDate, updatedAt: new Date() }).where(eq(stations.id, stationId));

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

    return {
      ...created,
      metricsJson: created.metricsJson ?? {},
    };
  }

  async update(userId: string, id: string, payload: TestHistoryUpdatePayload) {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new AppError('Test history record not found', 404, 'TEST_HISTORY_NOT_FOUND');
    }

    const updated = await db.transaction(async (tx) => {
      const record = await this.repository.updateById(
        id,
        {
          testDate: payload.testDate ? new Date(payload.testDate) : undefined,
          result: payload.result,
          notes: payload.notes,
          metricsJson: payload.metricsJson,
        },
        tx,
      );

      if (!record) {
        throw new AppError('Test history record not found', 404, 'TEST_HISTORY_NOT_FOUND');
      }

      const latest = await this.repository.getLatestTestDateByStation(existing.stationId, tx);
      await tx.update(stations).set({ lastTestDate: latest, updatedAt: new Date() }).where(eq(stations.id, existing.stationId));

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

    return {
      ...updated,
      metricsJson: updated.metricsJson ?? {},
    };
  }

  async delete(userId: string, id: string) {
    const existing = await this.repository.findById(id);

    if (!existing) {
      throw new AppError('Test history record not found', 404, 'TEST_HISTORY_NOT_FOUND');
    }

    await db.transaction(async (tx) => {
      const deleted = await this.repository.deleteById(id, tx);

      if (!deleted) {
        throw new AppError('Test history record not found', 404, 'TEST_HISTORY_NOT_FOUND');
      }

      const latest = await this.repository.getLatestTestDateByStation(existing.stationId, tx);
      await tx.update(stations).set({ lastTestDate: latest, updatedAt: new Date() }).where(eq(stations.id, existing.stationId));

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
    });

    return {
      success: true,
      id,
    };
  }
}

export const testHistoryService = new TestHistoryService();
