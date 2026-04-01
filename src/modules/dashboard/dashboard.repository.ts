import { and, count, desc, eq, gte, inArray } from 'drizzle-orm';

import { db } from '../../db/client';
import { stationIssueRecords, stationTestHistory, stations } from '../../db/schema';

export class DashboardRepository {
  async getSummary() {
    const [totalStationsRow, activeStationsRow, archivedStationsRow, maintenanceStationsRow, faultyStationsRow] =
      await Promise.all([
        db.select({ total: count() }).from(stations),
        db.select({ total: count() }).from(stations).where(eq(stations.status, 'active')),
        db.select({ total: count() }).from(stations).where(eq(stations.isArchived, true)),
        db.select({ total: count() }).from(stations).where(eq(stations.status, 'maintenance')),
        db.select({ total: count() }).from(stations).where(eq(stations.status, 'faulty')),
      ]);

    const [openIssuesRow, criticalIssuesRow] = await Promise.all([
      db
        .select({ total: count() })
        .from(stationIssueRecords)
        .where(inArray(stationIssueRecords.status, ['open', 'in_progress'])),
      db
        .select({ total: count() })
        .from(stationIssueRecords)
        .where(and(eq(stationIssueRecords.severity, 'critical'), inArray(stationIssueRecords.status, ['open', 'in_progress']))),
    ]);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    const [recentTestsRow] = await db
      .select({ total: count() })
      .from(stationTestHistory)
      .where(gte(stationTestHistory.testDate, sevenDaysAgo));

    return {
      totalStations: totalStationsRow[0]?.total ?? 0,
      activeStations: activeStationsRow[0]?.total ?? 0,
      archivedStations: archivedStationsRow[0]?.total ?? 0,
      maintenanceStations: maintenanceStationsRow[0]?.total ?? 0,
      faultyStations: faultyStationsRow[0]?.total ?? 0,
      totalOpenIssues: openIssuesRow[0]?.total ?? 0,
      totalCriticalIssues: criticalIssuesRow[0]?.total ?? 0,
      recentTestCount: recentTestsRow?.total ?? 0,
    };
  }

  async listRecentStations(limit: number) {
    return db
      .select({
        id: stations.id,
        name: stations.name,
        code: stations.code,
        status: stations.status,
        isArchived: stations.isArchived,
        updatedAt: stations.updatedAt,
      })
      .from(stations)
      .orderBy(desc(stations.updatedAt), desc(stations.id))
      .limit(limit);
  }

  async listRecentIssues(limit: number) {
    return db
      .select({
        id: stationIssueRecords.id,
        stationId: stationIssueRecords.stationId,
        stationName: stations.name,
        title: stationIssueRecords.title,
        severity: stationIssueRecords.severity,
        status: stationIssueRecords.status,
        createdAt: stationIssueRecords.createdAt,
      })
      .from(stationIssueRecords)
      .innerJoin(stations, eq(stationIssueRecords.stationId, stations.id))
      .orderBy(desc(stationIssueRecords.createdAt), desc(stationIssueRecords.id))
      .limit(limit);
  }

  async listRecentTests(limit: number) {
    return db
      .select({
        id: stationTestHistory.id,
        stationId: stationTestHistory.stationId,
        stationName: stations.name,
        result: stationTestHistory.result,
        testDate: stationTestHistory.testDate,
        createdAt: stationTestHistory.createdAt,
      })
      .from(stationTestHistory)
      .innerJoin(stations, eq(stationTestHistory.stationId, stations.id))
      .orderBy(desc(stationTestHistory.testDate), desc(stationTestHistory.id))
      .limit(limit);
  }
}

export const dashboardRepository = new DashboardRepository();
