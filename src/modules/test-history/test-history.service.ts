import { writeAuditLog } from '../../utils/audit-log';

import { stationsService, type StationsService } from '../stations/stations.service';
import { testHistoryRepository, type TestHistoryRepository } from './test-history.repository';

type TestHistoryPayload = {
  testDate?: string;
  result: 'pass' | 'fail' | 'warning';
  notes?: string;
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

    const created = await this.repository.create({
      stationId,
      testDate,
      result: payload.result,
      notes: payload.notes,
      metricsJson: payload.metricsJson ?? {},
      testedBy: userId,
    });

    await this.stationService.updateLastTestDate(stationId, testDate);

    await writeAuditLog({
      actorUserId: userId,
      entityType: 'station_test_history',
      entityId: created.id,
      action: 'station_test_history.created',
      metadataJson: {
        stationId,
        result: payload.result,
      },
    });

    return {
      ...created,
      metricsJson: created.metricsJson ?? {},
    };
  }
}

export const testHistoryService = new TestHistoryService();
